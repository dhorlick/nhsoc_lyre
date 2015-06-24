var baseUrl = "http://pluto.jhuapl.edu/soc/Pluto-Encounter/"

var request = require("request")
var htmlparser = require("htmlparser2")
var good_enough_date_time = require("./good_enough_date_time")
var tabular_output = require("./tabular_output")
var vm = require("vm")
var _ = require("underscore")
var url = require("url")
var querystring = require("querystring")
var tabular_input = require("./tabular_input")
var jsdom = require("jsdom")

var ORDERED_FIELD_NAMES = ["description", "thumb", "jpeg", "status", "meta", "acquired", "target", "range", "exposure", "name", "last modified"]

/**
 * @param if provided, will pull down only the requested page number.
 * @param testMode if true, will use a locally-sourced snapshot of the images web page and won't issue HTTP requests.
 * This is useful for automated testing and troubleshooting.
 */
function catalogueImagesFromNewHorizonsWebsite(page, format, testMode)
{
	if (page && page < 0)
		throw "If provided, page numbers must be positive integers: " + page + "."
	if (!format)
		format = "CSV"

	var outputHandler = outputHandlerForFormat(format)
	outputHandler.start(ORDERED_FIELD_NAMES)

	var captureJs = false
	var inlineScripting = ""
	var highestPageNumber = undefined

	var parser = new htmlparser.Parser({
		onopentag: function(name, attribs)
		{
			if (relevantScripting(name, attribs))
			{
				captureJs = true
			}
			else if (name == "a" && "href" in attribs)
			{
				var parsedUrl = url.parse(attribs.href)
				var parsedQueryString = querystring.parse(parsedUrl.query)
				if ("page" in parsedQueryString)
				{
					var page = parseInt(parsedQueryString["page"])
					if (highestPageNumber === undefined || page > highestPageNumber)
						highestPageNumber = page
				}
			}
		},
		ontext: function(text)
		{
			if (captureJs)
			{
				inlineScripting += text
			}
		},
		onclosetag: function(tagname)
		{
			if (captureJs && relevantScripting(tagname))
				captureJs = false
		}
	})

	var currentPageNumber = page?page:1
	var results = []

	function retrieveImageCataloguePage()
	{
		retrieveImageCataloguePageDom(function(html) {
			parser.write(html)
			parser.end()

			var highestPageNumberToRetrieve = page?page:highestPageNumber

			var sandbox = {
				jsdom: jsdom
			}

			var evalResult = vm.runInNewContext(
				[
					"function pageWidth() { return 600 }",
					"var document = jsdom.jsdom()",
					inlineScripting
				].join("\n"), sandbox)


			var sandboxResults = {
				thumbArr: sandbox.thumbArr,
				jpegArr: sandbox.jpegArr,
				StatusArr: sandbox.StatusArr,
				METArr: sandbox.METArr,
				UTCArr: sandbox.UTCArr,
				TargetArr: sandbox.TargetArr,
				RangeArr: sandbox.RangeArr,
				ExpArr: sandbox.ExpArr,
				DescArr: sandbox.DescArr,
				NameArr: sandbox.NameArr
			}

			multiZip({
				thumb: sandboxResults.thumbArr,
				jpeg: sandboxResults.jpegArr,
				status: sandboxResults.StatusArr,
				meta: sandboxResults.METArr,
				acquired: _.map(sandboxResults.UTCArr, function (dateStr) {
					return dateStr.replace("<br>", " ")
				}),
				target: sandboxResults.TargetArr,
				range: sandboxResults.RangeArr,
				exposure: sandboxResults.ExpArr,
				description: _.map(sandboxResults.DescArr, function (desc) {
					return decodeURIComponent(desc.replace(/\+/g, '%20'))
				}),
				name: sandboxResults.NameArr
			}, results)

			if (currentPageNumber < highestPageNumberToRetrieve)
			{
				currentPageNumber++
				retrieveImageCataloguePage()
			}
			else
			{
				// finished retrieving pages.

				if (results.length==0)
					throw "No results returned."

				if (!testMode) {
					saltInJpegLastModifiedHeader(results, "last-modified", "last modified", outputHandler, ORDERED_FIELD_NAMES)
				}
				else {
					for (var i=0; i<results.length; i++) {
						outputHandler.handleRecord(results[i], ORDERED_FIELD_NAMES)
					}
					outputHandler.stop()
				}

			}

		}, currentPageNumber, testMode)
	}

	retrieveImageCataloguePage()
}

function relevantScripting(name, attribs)
{
	return (name === "script" && (
			(attribs === undefined) || (attribs.language === "JavaScript" && !("src" in attribs))
			))
}

function retrieveImageCataloguePageDom(htmlFn, currentPageNumber, testMode)
{
	if (testMode)
	{
		fs = require("fs")
		var html = fs.readFileSync("test/test.html", "utf8")
		htmlFn(html)
	}
	else
	{
		var url = baseUrl + (currentPageNumber?("?page="+currentPageNumber):"")
		request({
			method: "GET",
			url: url
			}, function(error, response, html) {
			if (!error && response.statusCode == 200)
			{
				htmlFn(html)
			}
			else if (error)
			{
				throw error
			}
		})
	}
}

function multiZip(zippingRequest, optionalResults)
{
	var results = optionalResults?optionalResults:[]
	var lengths = _.uniq(_.map(_.values(zippingRequest), function(arrayValue) {return arrayValue.length}))
	switch (lengths.length)
	{
		case 0: 
			throw "No elements in array values."
			break
		case 1:			
			break
		default:
			throw "Array values have different lengths: " + lengths
	}
	
	var arrLength = lengths[0]
	for (var i=0; i<arrLength; i++)
	{
		var result = {}
		
		_.each(zippingRequest, function(arrayValue, key)
		{
			result[key] = arrayValue[i]
		})
		results.push(result)
	}
	return results
}

function saltInJpegLastModifiedHeader(imageArray, headerKey, propertyKey, outputHandler, orderedFieldNames)
{
	if (imageArray.length===0)
		return imageArray
	var processed = 0
	
	function collectJpegHeaderDate(image)
	{
		var url = baseUrl + image.jpeg

		request({
				method: "HEAD",
				url: url
			}, function(error, response, html) {
			if (!error && response.statusCode == 200)
			{
				if (headerKey in response.headers)
				{
					var headerValue = response.headers[headerKey]
					var dateTime = good_enough_date_time.LAST_MODIFIED_GOOD_ENOUGH_DATE_TIME_FORMAT.parseGoodEnoughDateTime(headerValue)
					var dateTimeValue = dateTime.casualFormat()
					var copy = _.extend(image, {})
					copy[propertyKey] = dateTimeValue
					outputHandler.handleRecord(copy, orderedFieldNames)
					processed++
					if (processed < imageArray.length)
					{
						collectJpegHeaderDate(imageArray[processed])
					}
					else
					{
						outputHandler.stop()
					}
				}	
				else
					throw "No header key: " +headerKey+ " in headers: " + JSON.stringify(response.headers)
			}
			else if (error)
			{
				throw error
			}
		})
	}
	
	collectJpegHeaderDate(imageArray[0])
}

function CSVOutputFormat() {}
CSVOutputFormat.prototype.start = function(fieldNames) { console.log(tabular_output.formatCsvRecord(fieldNames)) }
CSVOutputFormat.prototype.handleRecord = function(record, orderedFieldNames) {
	console.log(tabular_output.formatCsvRecord( _.map(orderedFieldNames, function(fieldName) {
		return record[fieldName]
	}) ))
}
CSVOutputFormat.prototype.stop = function() {}

function JSONArrayOutputFormat() {
	this.record_count = 0
}
JSONArrayOutputFormat.prototype.start = function(fieldNames) {console.log("[")}
JSONArrayOutputFormat.prototype.handleRecord = function(record, orderedFieldNames) {
	if (this.record_count > 0)
		console.log(",")
	console.log(JSON.stringify(record, undefined, 2))
	this.record_count++
}
JSONArrayOutputFormat.prototype.stop = function() { console.log("]") }

function XMLOutputFormat() {}
XMLOutputFormat.prototype.start = function(fieldNames) {
	console.log("<?xml version=\"1.0\"?>")
	console.log("<images>")
}
function escapeForXmlValue(content)
{
	if (content===undefined)
		return ""
	var result = tabular_output.replaceAll(content, "&", "&amp;")
	result = tabular_output.replaceAll(content, "<", "&lt;")
	result = tabular_output.replaceAll(content, ">", "&gt;")
	result = tabular_output.replaceAll(content, "\"", "&quot;")
	return result
}
function escapeForQName(content)
{
	var result = tabular_output.replaceAll(content, " ", "_")
	for (i=0; i<content.length; i++)
	{
		var ch = content.charAt(i)
		switch (ch)
		{
			case "&", "<", ">", "/", "\\", ":": throw "Elaborate punctuation not permitted: \"" + ch + "\"."
					// TODO escape punctuation, etc. Not so critical since we decide the field names to begin with.
		}
	}

	return result
}
XMLOutputFormat.prototype.handleRecord = function(record, orderedFieldNames) {
	var expressions = _.map(orderedFieldNames, function(fieldName) {
		return escapeForQName(fieldName) + "=\"" + escapeForXmlValue(record[fieldName]) + "\""
	})
	console.log("\t<image " + expressions.join(" ") + "/>")
}
XMLOutputFormat.prototype.stop = function() {
	console.log("</images>")
}

function outputHandlerForFormat(format)
{
	uppercaseFormat = format.toUpperCase()

	switch (uppercaseFormat)
	{
		case "CSV": return new CSVOutputFormat()
		case "JSON": return new JSONArrayOutputFormat()
		case "XML": return new XMLOutputFormat()
		default: throw "Unsupported format: " + format
	}
}

function strEndsWith(str, suffix)
{
	if (str === undefined || str === null)
		throw "No str provided."
	return str.indexOf(suffix, str.length - suffix.length) !== -1
}

function importFile(filePath, objArrayHandler)
{
	if (!filePath)
		throw "No filePath provided."

	if (strEndsWith(filePath, ".csv"))
	{
		return tabular_input.loadCsvFile(filePath, objArrayHandler)
	}
	else if (strEndsWith(filePath, ".json"))
	{
		throw "JSON import not yet implemented."
	}
	else if (strEndsWith(filePath, ".xml"))
	{
		throw "XML import not yet implemented."
	}
}

function CatalogueIndexDifferences(keysAdded, keysRemoved, changes, catalogueIndex1, catalogueIndex2) {
	if (!_.isArray(keysAdded))
		throw "Provided keysAdded is not an array."
	if (!_.isArray(keysRemoved))
		throw "Provided keysRemoved is not an array."
	if (!_.isObject(changes) || _.isArray(changes))
		throw "Provided changes is not an associative array."
	this.keysAdded = keysAdded
	this.keysRemoved = keysRemoved
	this.changes = changes
	this.catalogueIndex1 = catalogueIndex1
	this.catalogueIndex2 = catalogueIndex2
}
CatalogueIndexDifferences.prototype.toCsv = function() {
	var results = "disposition,"
    // TODO make sure header names are the header in both records
	results += tabular_output.formatCsvRecord(this.catalogueIndex1.orderedFieldNames)
	results += "\n"

	var that = this

	results += _.map(this.keysAdded, function(keyAdded) {
		var rowObj = that.catalogueIndex2.pkIndex[keyAdded]
		if (rowObj===undefined)
			throw "Could not find keyAdded: "+keyAdded+"."

		return "+,"+tabular_output.formatCsvRecord(_.map(that.catalogueIndex1.orderedFieldNames, function(fieldName) {
                return rowObj[fieldName]
            }))
	}).join("\n")

	results += _.map(this.keysRemoved, function(keyRemoved) {
		var rowObj = that.catalogueIndex1.pkIndex[keyRemoved]
		if (rowObj===undefined)
			throw "Could not find keyRemoved: "+keyRemoved+"."

		return "-,"+tabular_output.formatCsvRecord(_.map(that.catalogueIndex1.orderedFieldNames, function(fieldName) {
                return rowObj[fieldName]
            }))
	}).join("\n")

    results += _.map(_.keys(this.changes), function(keyChanged) {
        var changedFields = that.changes[keyChanged]
        var oldRecord = that.catalogueIndex1.pkIndex[keyChanged]
        var newRecord = that.catalogueIndex2.pkIndex[keyChanged]
        return "x," + _.map(that.catalogueIndex1.orderedFieldNames, function(orderedFieldName) {
            if (_.contains(changedFields, orderedFieldName))
                return oldRecord[orderedFieldName] + " -> " + newRecord[orderedFieldName]
            else
                return ""
        })
    }).join("\n")

	return results
}

CatalogueIndexDifferences.prototype.toHtmlDomTable = function(optionalCaptionText, optionalCellContentsTransform) {

    // TODO make sure header names are the header in both records
	var document = jsdom.jsdom()
	
    var table = document.createElement("table")
	if (optionalCaptionText)
	{
		var caption = document.createElement("caption")
		caption.appendChild(document.createTextNode(optionalCaptionText))
		table.appendChild(caption)
	}
	var style = document.createElement("style")
	style.type = "text/css"
    style.appendChild(document.createTextNode("tr:nth-child(odd).added td { background-color: LightGreen; }\n" +
			"tr:nth-child(even).added td { background-color: #CCEECC; }\n" +
			"tr:nth-child(odd).removed td { background-color: LightCoral; }\n" +
			"tr:nth-child(even).removed td { background-color: #F0BBBB; }\n" +
			"tr:nth-child(4n).changed td { background-color: PeachPuff; }\n" +
			"tr:nth-child(4n+1).changed td { background-color: PeachPuff; }\n" +
			"tr:nth-child(4n+2).changed td { background-color: #FFECEE; }\n" +
			"tr:nth-child(4n+3).changed td { background-color: #FFECEE; }\n" +
			"th { background-color: NavajoWhite; font-style: italic }" +
			"table { table-layout: fixed; width: 100%; border: thin solid; border-collapse: collapse; }" +
			"th,td { border: thin solid; font-size: small; }\n" +
			"td { word-wrap:break-word; font-family: Sans-Serif; font-size: small; }\n"))
    table.appendChild(style)
	var colGroup = document.createElement("colgroup")
	_.forEach([17], function(width) {
		var col = document.createElement("col")
		col.width = width
		colGroup.appendChild(col)
	})
	table.appendChild(colGroup)
    var tableHeader = document.createElement("thead")
    var headerRow = document.createElement("tr")
    function appendCell(cellElementName, tableRow, text, optionalStyleClass, fieldName)
	{
        var cell = document.createElement(cellElementName)
        if (optionalStyleClass)
            cell.setAttribute("class", optionalStyleClass)
		var appendable = (!!optionalCellContentsTransform)?optionalCellContentsTransform(text, fieldName, document):document.createTextNode(text)
        cell.appendChild(appendable)
        tableRow.appendChild(cell)
		return cell
    }
    function appendHeaderCell(text) { return appendCell("th", headerRow, text)}
    function appendBodyCell(tableRow, text, optionalStyleClass, fieldName)
	{
		return appendCell("td", tableRow, text, optionalStyleClass, fieldName)
	}
	appendHeaderCell("").setAttribute("style", "border-right-style: none;") // to leave room for a disposition cell (i.e +, -, x)
    var headerCellCount = 0
	_.forEach(this.catalogueIndex1.orderedFieldNames, function(orderedFieldName) {
        var cell = appendHeaderCell(orderedFieldName)
		if (headerCellCount==0)
		{
			cell.setAttribute("style", "border-left-style: none;")
		}
		headerCellCount++
    })
	tableHeader.appendChild(headerRow)
    table.appendChild(tableHeader)
    var tableBody = document.createElement("tbody")
    table.appendChild(tableBody)

    var that = this

    _.forEach(this.keysAdded, function(keyAdded) {
        var rowObj = that.catalogueIndex2.pkIndex[keyAdded]
        if (rowObj===undefined)
            throw "Could not find keyAdded: "+keyAdded+"."
        var tableRow = document.createElement("tr", "added")
		tableRow.className = "added"
        appendBodyCell(tableRow, "+")
        _.forEach(that.catalogueIndex1.orderedFieldNames, function(fieldName) {
            appendBodyCell(tableRow, rowObj[fieldName], undefined, fieldName)
        })
		tableBody.appendChild(tableRow)
    })

    _.forEach(this.keysRemoved, function(keyRemoved) {
        var rowObj = that.catalogueIndex1.pkIndex[keyRemoved]
        if (rowObj===undefined)
            throw "Could not find keyRemoved: "+keyRemoved+"."
        var tableRow = document.createElement("tr", "removed")
		tableRow.className = "removed"
        appendBodyCell(tableRow, "-")
        _.forEach(that.catalogueIndex1.orderedFieldNames, function(fieldName) {
            appendBodyCell(tableRow, rowObj[fieldName], undefined, fieldName)
        })
		tableBody.appendChild(tableRow)
    })

    _.forEach(_.keys(this.changes), function(keyChanged) {
        var changedFields = that.changes[keyChanged]
        var oldRecord = that.catalogueIndex1.pkIndex[keyChanged]
        var newRecord = that.catalogueIndex2.pkIndex[keyChanged]
        var addTableRow = document.createElement("tr", "added")
		addTableRow.className = "changed"
		appendBodyCell(addTableRow, "+")
		var removeTableRow = document.createElement("tr", "removed")
		removeTableRow.className = "changed"
		appendBodyCell(removeTableRow, "-")
		tableBody.appendChild(addTableRow)
		tableBody.appendChild(removeTableRow)
		_.forEach(that.catalogueIndex1.orderedFieldNames, function(orderedFieldName) {
            if (_.contains(changedFields, orderedFieldName))
            {
				appendBodyCell(removeTableRow, oldRecord[orderedFieldName], undefined, orderedFieldName)
                appendBodyCell(addTableRow, newRecord[orderedFieldName], undefined, orderedFieldName)
            }
            else
			{
				appendBodyCell(addTableRow, oldRecord[orderedFieldName], undefined, orderedFieldName).rowSpan = 2
			}
        })
    })

	return table
}

function CatalogueIndex(objArr, key, orderedFieldNames) {
	if (!_.isArray(objArr))
		throw "Provided objArr is not an array."
	if (!_.isArray(orderedFieldNames))
		throw "Provided orderedFieldNames is not an array, it's a " + (typeof orderedFieldNames) + "."
	this.pkIndex = {}
	this.pkMemo = {}
	var that = this
	_.forEach(objArr, function(elem) {
		if (!_.isObject(elem) || _.isArray(elem))
			throw "Element " + elem + " is not an associative array."
		var pkVal = elem[key]
		if (pkVal===undefined || pkVal===null)
			throw "Couldn't find value for primary key: " + key +" in: " + elem + "."
		that.pkIndex[pkVal] = elem
		var orderedFieldNamesWithoutPk = _.without(orderedFieldNames, key)
		that.pkMemo[elem[key]] = tabular_output.formatCsvRecord( _.map(orderedFieldNamesWithoutPk, function(fieldName) {
			return elem[fieldName]
		}) )
	})
	this.pkSort = _.sortBy(objArr, function(obj) {
		return obj[key]
	})
	this.orderedFieldNames = orderedFieldNames
	this.objArr = objArr
	this.key = key
}
CatalogueIndex.prototype.diff = function(catIndex2) {
	var keys2 = _.pluck(catIndex2.pkSort, this.key)
	var keys1 = _.pluck(this.pkSort, this.key)
	var added = _.difference(keys2, keys1)
	var removed = _.difference(keys1, keys2)
	var common = _.intersection(keys1, keys2)
	var changes = {}
	for (var i = 0; i < common.length; i++)
	{
		var key = common[i]
		if (this.pkMemo[key] !== catIndex2.pkMemo[key]) {
			var changedFields = []
			changes[key] = changedFields

			var oldRow = this.pkIndex[key]
			var newRow = catIndex2.pkIndex[key]

			_.forEach(this.orderedFieldNames, function(fieldName) {
				if (oldRow[fieldName]!=newRow[fieldName])
					changedFields.push(fieldName)
			})
		}
	}
	return new CatalogueIndexDifferences(added, removed, changes, this, catIndex2)
}

function compareExports(filePath1, filePath2, handleDiffs)
{
	var pk = "meta"
	var sortByPk = function(objArr) {
		return _.sortBy(objArr, function(obj) {
			return obj[pk]
		})
	}

	importFile(filePath1, function(imageCatalogue1) {
		importFile(filePath2, function(imageCatalogue2) {
			var imageIndex1 = new CatalogueIndex(sortByPk(imageCatalogue1), pk, ORDERED_FIELD_NAMES)
			var imageIndex2 = new CatalogueIndex(sortByPk(imageCatalogue2), pk, ORDERED_FIELD_NAMES)

			var diffs = imageIndex1.diff(imageIndex2)
			handleDiffs(diffs)
		})
	})

}

function buildNhSocLinkedHtmlDomTable(diffs, optionalCaption)
{
	return diffs.toHtmlDomTable(optionalCaption, function(text, fieldName, document) {
		var textNode = document.createTextNode(text)
		if (!fieldName || !document)
			return textNode
		var IMAGE_URL_BASE = "http://pluto.jhuapl.edu/soc/Pluto-Encounter/"
		switch (fieldName.toLowerCase())
		{
			case "jpeg":
			case "thumb":
				var anchor = document.createElement("a")
				anchor.href = (IMAGE_URL_BASE + text)
				anchor.appendChild(textNode)
				return anchor
			default:
				return textNode
		}
	})
}

var nhsoc_lyre = exports
nhsoc_lyre.catalogueImagesFromNewHorizonsWebsite = catalogueImagesFromNewHorizonsWebsite
nhsoc_lyre.importFile = importFile
nhsoc_lyre.compareExports = compareExports
nhsoc_lyre.buildNhSocLinkedHtmlDomTable = buildNhSocLinkedHtmlDomTable