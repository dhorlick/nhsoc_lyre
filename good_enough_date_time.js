var _ = require("underscore")

/**
 * Faithfully transcribes date and time details, without transformation. Records integer values for year, month
 * (one-ordered), day, hour (0-23), and minute. Records float value for seconds. Records a string for time zone
 * abbreviation.
 *
 * Deliberately provides no support for date or time arithmetic.
 *
 * When the recorded timezone is UTC, it will output in ISO-8601. Otherwise, it will output in a similar format that
 * sorts in time-order within a timezone.
 */
function GoodEnoughDateTime(parts)
{
    if (!_.isArray(parts))
        throw "Non-array parts var: "+typeof parts
    if (parts.length<6)
        throw "Must have at least 6 parts; has " + parts.length + "."
    if (parts.length==7 && parts[6] !== undefined && typeof parts[6] !== "string" && !_.isNumber(parts[6]))
        throw "Non-string, non-integer time zone: " + parts[6] + "."
    if (parts.length > 7)
        throw "Shouldn't provide more than 7 parts; " + parts.length + "."

    var partsCopy = parts.slice(0)

    for (i=0; i<5; i++)
    {
        if (!_.isNumber(partsCopy[i]))
            partsCopy[i] = parseInt(partsCopy[i])
    }

    if (!_.isNumber(partsCopy[5]))
    {
        partsCopy[5] = parseFloat(partsCopy[5])
    }

    this.parts = partsCopy
}

function noLessThanTwoDigits(value)
{
    if (_.isNumber(value) && value >= 0)
    {
        if (value<10)
            return "0" + value
    }
    return value
}

GoodEnoughDateTime.prototype.toString = function()
{
    return this.getYear()+"-"+noLessThanTwoDigits(this.getMonth())+"-"+noLessThanTwoDigits(this.getDayOfMonth())+"T"
            +noLessThanTwoDigits(this.getHour())+":"+noLessThanTwoDigits(this.getMinute())+":"+noLessThanTwoDigits(this.getSecond())
            +(this.isUTC()?"Z":(this.getTimeZone()?(" "+this.getTimeZone()):""))
}
GoodEnoughDateTime.prototype.casualFormat = function()
{
    return this.getYear()+"-"+noLessThanTwoDigits(this.getMonth())+"-"+noLessThanTwoDigits(this.getDayOfMonth())+" "
        +noLessThanTwoDigits(this.getHour())+":"+noLessThanTwoDigits(this.getMinute())+":"+noLessThanTwoDigits(this.getSecond())
        +(this.getTimeZone()?(" "+this.getTimeZone()):"")
}

GoodEnoughDateTime.prototype.getYear = function()
{
    return this.parts[0]
}
GoodEnoughDateTime.prototype.getMonth = function()
{
    return this.parts[1]
}
GoodEnoughDateTime.prototype.getDayOfMonth = function()
{
    return this.parts[2]
}
GoodEnoughDateTime.prototype.getHour = function()
{
    return this.parts[3]
}
GoodEnoughDateTime.prototype.getMinute = function()
{
    return this.parts[4]
}
GoodEnoughDateTime.prototype.getSecond = function()
{
    return this.parts[5]
}
/**
 * @returns a String time zone abbreviation.
 */
GoodEnoughDateTime.prototype.getTimeZone = function()
{
    return this.parts[6]
}
GoodEnoughDateTime.prototype.isUTC = function()
{
    return (this.getTimeZone()==="Z" || this.getTimeZone()==="UTC")
}

function GoodEnoughDateTimeFormat(indexOrder, delimiters, swaps)
{
    if (!_.isArray(indexOrder))
        throw "indexOrder: " + indexOrder + " isn't an array."
    if (!_.isArray(delimiters))
        throw "delimiters: " + delimiters + " isn't an array."
    if (swaps && !_.isObject(swaps))
        throw "swaps: " + swaps + " isn't an object."

    for (i=0; i<indexOrder.length; i++)
    {
        if (!_.isNumber(indexOrder[i]))
            throw "Non-int array element type: " + typeof indexOrder[i]
    }

    this.indexOrder = indexOrder
    this.delimiters = delimiters
    this.swaps = swaps
}

fancySplit = function(valueString, delimeters)
{
    var word = ""
    var words = []

    for (i=0; i<valueString.length; i++)
    {
        var ch = valueString.charAt(i)
        if (!(_.contains(delimeters, ch)))
            word += ch
        else
        {
            if (word.length > 0)
            {
                words.push(word)
                word = ""
            }
        }
    }

    if (word.length > 0)
    {
        words.push(word)
    }

    return words
}

GoodEnoughDateTimeFormat.prototype.parseGoodEnoughDateTime = function parseGoodEnoughDateTime(valueString)
{
    var providedWords = fancySplit(valueString, this.delimiters)
    var parts = []
    for (i=0; i<this.indexOrder.length; i++)
    {
        var newPosition = this.indexOrder[i]
        if (newPosition>=0)
        {
            var providedWord = providedWords[i]
            if (providedWord in this.swaps)
                parts[newPosition] = this.swaps[providedWord]
            else
                parts[newPosition] = providedWord
        }
    }

    return new GoodEnoughDateTime(parts)
}

LAST_MODIFIED_GOOD_ENOUGH_DATE_TIME_FORMAT = new GoodEnoughDateTimeFormat([-1, 2, 1, 0, 3, 4, 5, 6], [".", " ", "-", ":"], {
    "Jan": 1,
    "Feb": 2,
    "Mar": 3,
    "Apr": 4,
    "May": 5,
    "Jun": 6,
    "Jul": 7,
    "Aug": 8,
    "Sep": 9,
    "Oct": 10,
    "Nov": 11,
    "Dec": 12}) // Mon, 18 May 2015 20:06:02 GMT

var good_enough_date_time = exports

good_enough_date_time.GoodEnoughDateTime = GoodEnoughDateTime
good_enough_date_time.GoodEnoughDateTimeFormat = GoodEnoughDateTimeFormat
good_enough_date_time.LAST_MODIFIED_GOOD_ENOUGH_DATE_TIME_FORMAT = LAST_MODIFIED_GOOD_ENOUGH_DATE_TIME_FORMAT
good_enough_date_time.fancySplit = fancySplit