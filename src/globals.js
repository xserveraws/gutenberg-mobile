/** @format */

import { createElement } from '@wordpress/element';
import jsdom from 'jsdom-jscore';

global.wp = {
	element: {
		createElement, // load the element creation function, needed by Gutenberg-web
	},
};

const doc = jsdom.html( '', null, null );

// inject a simple version of the missing createHTMLDocument method that `hpq` depends on
doc.implementation.createHTMLDocument = function( html ) {
	return jsdom.html( html, null, null );
};

// `hpq` depends on `document` be available globally
global.document = doc;

// Override the default console.error to demote the errors coming from the GB parser.
// TODO: change the GB code to a more flexible solution that doesn't require overriding the default console.
/* eslint-disable no-console */
const cerr = console.error;
console.error = function( logMessage ) {
	if ( logMessage.startsWith( 'Block validation:' ) ) {
		console.log( logMessage );
	} else {
		cerr( logMessage );
	}
};
/* eslint-enable no-console */
