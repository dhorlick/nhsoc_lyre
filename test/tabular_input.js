var assert = require("assert")
var tabular_input = require("../tabular_input")
var _ = require("underscore")

function assertArraysEqual(a, b)
{
    if (_.isEqual(a, b))
        return

    assert.equal(a, b) // can't handle arrays deep equals, so will fail as desired providing helpful output
}

assertArraysEqual(["one", "two", "three"], tabular_input.parseCsvLine("one,two,three"))
assertArraysEqual(["one", "two", "three"], tabular_input.parseCsvLine("one,\"two\",three"))
assertArraysEqual(["one", "t\"wo", "three"], tabular_input.parseCsvLine("one,\"t\"\"wo\",three"))
assertArraysEqual(["one", "t,wo", "three"], tabular_input.parseCsvLine("one,\"t,wo\",three"))