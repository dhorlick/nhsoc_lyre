# Introduction

New Horizons Science Operations Center Lyre (hereafter, "nhsoc_lyre") is a command line script for pulling down LORRI image metadata from the New Horizons project website. When this was written, the New Horizons spacecraft was well on its way to the Pluto System. After completing a flyby, it will proceed to one or more targets in the Kuiper Belt.

This program isn't officially affiliated with or endorsed by the New Horizons project.

# Implementation

Most of the image metadata is provided as inline JavaScript code spread across several webpages on the New Horizons project website. For each page, nhsoc_lyre

1. Parses the HTML content.
1. Analyzes links to determine the number of pages.
1. Parses relevant inline JavaScript code using the V8 JavaScript engine and a sandboxed Node.js environment.
1. Extracts relevant data from the sandboxed environment.
1. Decodes any encoding.

The data from the inline JavaScript code doesn't include image publish dates. Consequently, once all webpages have been consumed, nhsoc_lyre will then request the HTTP header for each JPEG image to determine its Last-Modified date. This seems to lead the publish date slightly, but hopefully can be taken as a rough proxy.

# Installation

You'll need to install [Node.js and npm](https://nodejs.org) before you can install ngsoc_lyre.

Once you have Node.js and npm, you can choose to install nhsoc_lyre automatically, or from sources.

## Automated Installation

Change into a convenient directory and type

`npm install nhsoc_lyre`

This will install `./node_modules/` relative to this location. This new directory will in turn will contain a `.bin` sub-directory. You should either prefix the get_nhsoc_image_metadata script with a relative path to this sub-directory from the current directory at execution time, or add it to your system path.

## Installation from Sources

To install nhsoc_lyre from sources, download the source archive from github, or (after first installing git if necessary) clone the project directly from github.

Now change into the nhsoc_lyre project directory and type

`npm install`

Now you should be able to run the get_nhsoc_image_metadata script in `./bin`, or add this sub-directory to your system path.

## Troubleshooting installation

You shouldn't receive any error messages or be prompted to escalate shell privileges. Should either of these things happen, Node.js may not have weathered an operating system upgrade applied since its installation. You may be able to workaround by renaming or deleting the ``.npm`` sub-directory in your home directory.

# Usage

To run the script, type

`./node_modules/.bin/get_nhsoc_image_metadata`

(prefixing with the appropriate relative path if necessary; see Installation, above)

You will probably find it useful to direct nhsoc_lyre's output to a file

`./node_modules/.bin/get_nhsoc_image_metadata > pluto_images.csv`

The default output format is CSV. If you prefer, you can specify JSON or XML

`./node_modules/.bin/get_nhsoc_image_metadata > pluto_images.json --format=JSON`

If you'd prefer a single page of data, provide that page's number as an argument

`./node_modules/.bin/get_nhsoc_image_metadata > nhsoc_pluto_images.csv --page=1`

If you elect to pull down metadata for all images on the project website, you should expect it to take a minute of time or longer.

Although nhsoc_lyre doesn't retrieve actual images, it nevertheless can request a large amount of data. Please remember that this data and the server that hosts it are provided for everyone's benefit and use them respectfully.

# Validation

To run a lint check and automated tests on nhsoc_lyre, enter

`npm run test`

This test suite shouldn't need a working network connection and won't attempt to contact the New Horizons project website.

# Related Tools

[newhorizonsbot](https://github.com/barentsen/NewHorizonsBot/), a Python tool to pull down and tweet images from the New Horizons website.

# Frequently Asked Questions

## Why is the script named "New Horizons Science Operations Center Lyre"?

The lyre reference is an allusion to the myth of Orpheus.

## Why was it implemented in JavaScript?

As mentioned earlier, the New Horizons project website conveys image metadata as JavaScript code. Consequently, JavaScript was chosen as the development language for integration ease, and to minimize the number of technologies used.

## Why are the acquisition date-times in UTC, while the Last Modified date-times are in GMT?

It's typical for Last-Modified HTTP headers to be expressed in GMT. For new applications, GMT's use has largely been superseded by UTC, which is nearly but not exactly the same. For most purposes the difference can be ignored, and indeed the server may well be misrepresenting UTC as GMT.
