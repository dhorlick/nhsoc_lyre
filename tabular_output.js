var _ = require("underscore")

function replaceAll(content, replaceable, replacement)
{
    if (replaceable.length > 1)
        throw "Illegal length for argument: " + replaceable.length + ". Cannot exceed 1."
    if (content === undefined)
        throw "No content provided."
    var mappedContent = ""

    for (i=0; i < content.length; i++)
    {
        var ch = content.charAt(i)
        switch (ch)
        {
            case replaceable:
                mappedContent += replacement
                break
            default:
                mappedContent += ch
        }
    }

    return mappedContent
}

function escapeIfNecessary(content, quoteCharacter, quoteReplacement, eventualDelimeter)
{
    if (content === undefined || content === null)
        return ""

    if (content.indexOf(quoteCharacter)!=-1)
    {
        // Can't use string.replace because metacharacters
        var content = replaceAll(content, quoteCharacter, quoteReplacement)
    }
    else if (content.indexOf(eventualDelimeter)==-1)
        return content

    return quoteCharacter + content + quoteCharacter
}

function formatCsvRecord(values)
{
    return _.map(values, function(value) { return escapeIfNecessary(value, "\"", "\"\"", ",") }).join(",")
}

var tabular_output = exports
tabular_output.formatCsvRecord = formatCsvRecord
tabular_output.escapeIfNecessary = escapeIfNecessary
tabular_output.replaceAll = replaceAll