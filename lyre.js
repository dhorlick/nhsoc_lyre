#!/usr/bin/env node

var nhsoc_lyre = require("./nhsoc_lyre")
var _ = require("underscore")
var program = require('commander')

program
	.description("pull down an image metadata catalogue from the New Horizons website.")
	.option('-p, --page [page]', 'page', parseInt)
	.option('-f, --format [format]', 'output format CSV|JSON. defaults to CSV')

program.parse(process.argv)

var page = program.page?program.page:undefined
var format = program.format?program.format:undefined

nhsoc_lyre.catalogueImagesFromNewHorizonsWebsite(page, format)
