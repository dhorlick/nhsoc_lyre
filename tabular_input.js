var _ = require("underscore")
var fs = require("fs")
var readline = require("readline")

function parseCsvLine(line)
{
    var STATE_READY = "ready"
    var STATE_IN_QUOTED_CELL = "in quoted cell"
    var STATE_EITHER_AT_END_OF_QUOTED_CELL_OR_JUST_BEFORE_ESCAPED_QUOTE_CHARACTER = "either at end of quoted cell or just before escaped quote character"

    var state = STATE_READY
    var results = []
    var accumulatedWord = ""

    for (var i=0; i<line.length; i++)
    {
        var ch = line.charAt(i)
        switch (ch) {
            case "\"":
                switch (state) {
                    case STATE_READY:
                        state = STATE_IN_QUOTED_CELL
                        break
                    case STATE_IN_QUOTED_CELL:
                        state = STATE_EITHER_AT_END_OF_QUOTED_CELL_OR_JUST_BEFORE_ESCAPED_QUOTE_CHARACTER
                        break
                    case STATE_EITHER_AT_END_OF_QUOTED_CELL_OR_JUST_BEFORE_ESCAPED_QUOTE_CHARACTER:
                        accumulatedWord += "\""
                        state = STATE_IN_QUOTED_CELL
                        break
                }
                break
            case ",":
                switch (state) {
                    case STATE_READY:
                        results.push(accumulatedWord)
                        accumulatedWord = ""
                        break
                    case STATE_IN_QUOTED_CELL:
                        accumulatedWord += ch
                        break
                    case STATE_EITHER_AT_END_OF_QUOTED_CELL_OR_JUST_BEFORE_ESCAPED_QUOTE_CHARACTER:
                        // was not just before an escaped quote character
                        results.push(accumulatedWord)
                        accumulatedWord = ""
                        state = STATE_READY
                        break
                }
                break
            default:
                accumulatedWord += ch
        }
    }

    switch (state)
    {
        case STATE_READY:
        case STATE_IN_QUOTED_CELL:
            results.push(accumulatedWord)
    }

    return results
}

function loadCsvFile(filePath, objArrayHandler)
{
    var readStream = fs.createReadStream(filePath)
    var lineIndex = 0
    var headerRow = undefined
    var results = []

    var myInterface = readline.createInterface({
        input: fs.createReadStream(filePath),
        terminal: false
    })

    myInterface.on("line", function(line) {
        var parsed = parseCsvLine(line)
        switch (lineIndex)
        {
            case 0:
                headerRow = parsed
                break
            default:
                if (!headerRow)
                    throw "Can't proceed; encountered new header row."
                results.push(_.object(headerRow, parsed))
        }
        lineIndex++
    }).on("close", function() {
        if (objArrayHandler)
            objArrayHandler(results)
    })
}

tabular_input = exports
tabular_input.loadCsvFile = loadCsvFile
tabular_input.parseCsvLine = parseCsvLine
