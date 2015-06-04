var baseUrl = "http://pluto.jhuapl.edu/soc/Pluto-Encounter/"

var request = require("request")
var htmlparser = require("htmlparser2")
var good_enough_date_time = require("./good_enough_date_time")
var tabular_output = require("./tabular_output")
var vm = require("vm")
var _ = require("underscore")
var url = require("url")
var querystring = require("querystring")

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
	var orderedFieldNames = ["description", "thumb", "jpeg", "status", "meta", "acquired", "target", "range", "exposure", "name", "last modified"]
	outputHandler.start(orderedFieldNames)

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

			var sandbox = {}

			var evalResult = vm.runInNewContext(
				[
					"function pageWidth() { return 600 }",
					"function Document() {}",
					"Document.prototype.writeln = function() {}",
					"document = new Document()",
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
					saltInJpegLastModifiedHeader(results, "last-modified", "last modified", outputHandler, orderedFieldNames)
				}
				else {
					for (i=0; i<results.length; i++)
						outputHandler.handleRecord(results[i], orderedFieldNames)
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
	for (i=0; i<arrLength; i++)
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

function outputHandlerForFormat(format)
{
	uppercaseFormat = format.toUpperCase()

	switch (uppercaseFormat)
	{
		case "CSV": return new CSVOutputFormat()
		case "JSON": return new JSONArrayOutputFormat()
		default: throw "Unsupported format: " + format
	}
}

var nhsoc_lyre = exports
nhsoc_lyre.catalogueImagesFromNewHorizonsWebsite = catalogueImagesFromNewHorizonsWebsite