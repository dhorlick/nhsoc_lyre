var assert = require("assert")
var tabular_output = require("../tabular_output")

assert.equal("My,very,excellent,mother,clearly,just,served,us,nine,pizzas",
        tabular_output.formatCsvRecord(["My", "very", "excellent", "mother", "clearly", "just", "served", "us", "nine", "pizzas"]))
assert.equal("\"Tombaugh, Clyde\",\"Christy, James\"", tabular_output.formatCsvRecord(["Tombaugh, Clyde", "Christy, James"]))
assert.equal("\"Oo\"\"rt\",\"\"\"Kuiper\"\"\"", tabular_output.formatCsvRecord(["Oo\"rt", "\"Kuiper\""]))
assert.equal("", tabular_output.formatCsvRecord([undefined]))