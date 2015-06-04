var _ = require("underscore")

function escapeIfNecessary(content, quoteCharacter, quoteReplacement, eventualDelimeter)
{
    if (content === undefined || content === null)
        return ""

    if (content.indexOf(quoteCharacter)!=-1)
    {
        // Can't use string.replace because metacharacters
        var mappedContent = ""

        for (i=0; i < content.length; i++)
        {
            var ch = content.charAt(i)
            switch (ch)
            {
                case quoteCharacter:
                    mappedContent += quoteReplacement
                    break
                default:
                    mappedContent += ch
            }
        }
        content = mappedContent
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