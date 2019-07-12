const url = require('url');
const os = require('os');

const util = exports = module.exports = {};

// Normalizes unimportant differences in URLs - e.g. ensures
// http://google.com/ and http://google.com normalize to the same string
util.normalizeUrl = function(u) {
	return url.format(url.parse(u, true));
};

util.getOptions = function(req) {

	var requestedUrl = req.url;

	//new API starts with render so we'll parse the URL differently if found
	if(requestedUrl.indexOf('/render') === 0) {

		let optionsObj = {};
		if(req.method === 'GET') {
			optionsObj = url.parse(requestedUrl, true).query;
		} else if (req.method === 'POST') {
			optionsObj = req.body;
		}

		return {
			url: util.getUrl(optionsObj.url),
			renderType: optionsObj.renderType || 'html',
			userAgent: optionsObj.userAgent,
			fullpage: optionsObj.fullpage || false,
			width: optionsObj.width,
			height: optionsObj.height,
			followRedirects: optionsObj.followRedirects,
			javascript: optionsObj.javascript
		}

	} else {

		return {
			url: util.getUrl(requestedUrl),
			renderType: 'html'
		}
	}
}

// Gets the URL to prerender from a request, stripping out unnecessary parts
util.getUrl = function(requestedUrl) {
	var decodedUrl, realUrl = requestedUrl,
		parts;

	if (!requestedUrl) {
		return '';
	}

	realUrl = realUrl.replace(/^\//, '');

	try {
		decodedUrl = decodeURIComponent(realUrl);
	} catch (e) {
		decodedUrl = realUrl;
	}

	//encode a # for a non #! URL so that we access it correctly
	decodedUrl = this.encodeHash(decodedUrl);

	//if decoded url has two query params from a decoded escaped fragment for hashbang URLs
	if (decodedUrl.indexOf('?') !== decodedUrl.lastIndexOf('?')) {
		decodedUrl = decodedUrl.substr(0, decodedUrl.lastIndexOf('?')) + '&' + decodedUrl.substr(decodedUrl.lastIndexOf('?') + 1);
	}

	parts = url.parse(decodedUrl, true);

	// Remove the _escaped_fragment_ query parameter
	if (parts.query && parts.query['_escaped_fragment_'] !== undefined) {

		if (parts.query['_escaped_fragment_'] && !Array.isArray(parts.query['_escaped_fragment_'])) {
			parts.hash = '#!' + parts.query['_escaped_fragment_'];
		}

		delete parts.query['_escaped_fragment_'];
		delete parts.search;
	}

	// Bing was seen accessing a URL like /?&_escaped_fragment_=
	delete parts.query[''];

	var newUrl = url.format(parts);

	//url.format encodes spaces but not arabic characters. decode it here so we can encode it all correctly later
	try {
		newUrl = decodeURIComponent(newUrl);
	} catch (e) {}

	newUrl = this.encodeHash(newUrl);

	return newUrl;
};

util.encodeHash = function(url) {
	if (url.indexOf('#!') === -1 && url.indexOf('#') >= 0) {
		url = url.replace(/#/g, '%23');
	}

	return url;
}

function log(logLevel, args) {
    if (process.env.DISABLE_LOGGING) {
        return;
    }
    if (process.env.FLUENTD_LOGGING) {
        let log_obj = {
            "@timestamp": new Date().toISOString(),
            "@message": Array.prototype.slice.call(args, 0).join(' '),
            "@source_host": os.hostname(),
            "@tags": [
                process.env.LOGSTASH_TAG
            ],
            "@type": "fluentd",
            "@fields": {
                "levelname": logLevel,
                "logger": "prerender",
                "stack_info": null,
                "request_id": null,
                "alias": null
            },
            "@version": "1",
            "host": os.hostname(),
            "port": process.env.PORT || process.env.PORT0 || 8000
        };
        console.log(JSON.stringify(log_obj));
    } else {
        console.log.apply(console.log, [new Date().toISOString()].concat(Array.prototype.slice.call(args, 0)));
    }
}

util.log = function () {
    log(process.env.LOGSTASH_LOGLEVEL, arguments);
};
util.info = function () {
    log('INFO', arguments);
};
util.error = function () {
    log('ERROR', arguments);
};
