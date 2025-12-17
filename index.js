const CoffeeScript = require('coffeescript')
const through = require('through2')
const replaceExt = require('replace-ext')
const PluginError = require('plugin-error')
const parse5 = require("parse5")
const sass = require('sass')

module.exports = function(options){

	function clearContent(contents) {
		if(options.removeBlankLines)
			return contents.split('\n').filter(function(x){ return x.trim() != "" }).join("\n")
		return contents
	}

  function replaceExtension(path) {
    var path = path.replace(/\.coffee\.md$/, '.litcoffee')
    return replaceExt(path, '.js')
  }

  function transform (file, encoding, callback){
    
    if (file.isNull())
      return callback(null, file)
    

    if (file.isStream())
      return callback(PluginError('myPlugin', 'Streaming not supported'))
    
 
    contents = file.contents.toString('utf8')

    output = compile(file, contents, options)

    file.contents = new Buffer(output)

    callback(null, file)
	}

	function isLang(contents, lang){
		return  new RegExp("lang=[\"']"+lang).test(contents)
	}

	function compile(file, contents, options){

	  var scriptContents = parse(contents, 'script', {emptyExport: false})
	  var templateContents = parse(contents, 'template', {emptyExport: false})
	  var styleContents = parse(contents, 'style', {emptyExport: false})

	  var scriptContents = clearContent(scriptContents)
	  var templateContents = clearContent(templateContents)
	  var styleContents = clearContent(styleContents)

	  var outScript = scriptContents
	  var outTemplate = templateContents
	  var outStyle = styleContents

	  var templateLang = isLang(contents, "pug") ? 'lang="pug"' : ""
	  var styleLang = isLang(contents,"sass") ? 'lang="sass"' : (isLang(contents, "scss") ? 'lang="scss"' : "")
	  var scopedStyle = /<(.+)?style(.+)scoped(.+)?>/.test(contents) ? "scoped" : ""
	  //var scriptLang = isLang(contents, "coffee") ? 'lang="coffee"' : "" 

	  if(options.coffee && options.coffee.compile){

	  	if(isLang(contents, "coffee")){

		    var coffeeCompileOptions = Object.assign({
		      bare: false,
		      header: false,
		      sourceRoot: false,
		      literate: /\.(litcoffee|coffee\.md)$/.test(file.path),
		      filename: file.path,
		      sourceFiles: [file.relative],
		      generatedFile: replaceExtension(file.relative)
		    }, options.coffee.options)  

		  	try {
		  		outScript = CoffeeScript.compile(scriptContents, coffeeCompileOptions)
		  	} catch (err) { 
		  		console.error(`Error on copile coffee file ${file.path}: ${err}`)
		  		throw err		  		
		  	}
	  	}
		}

	  if(options.sass && options.sass.compile){

	  	if(isLang(contents, "sass")){

		  	try {

		  		var sassContent = styleContents

		  		if(options.sass.replacer)
		  			sassContent = options.sass.replacer(sassContent)

		  		var lines = sassContent.split("\n")
		  		var newLines = []
		  		var first = false
		  		var removeStartSpace = false
		  		var spacesToReplace = 0
		  		for(var i in lines){
		  			line = lines[i]

		  			if(line.trim() != "" && !first){
						first = true

			  			if (line.startsWith(" ")){
			  				for(var l = 0; l < line.length; l++){
			  					if(line.charAt(l) == ' '){
			  						spacesToReplace++;
			  						continue
			  					}
			  					break
			  				}			  				
			  			}			  			
		  			}

		  			if(spacesToReplace > 0) {
		  				newLines.push(line.substring(spacesToReplace))
		  			} else {
		  				newLines.push(line)
		  			}

		  		}

		  		sassContent = newLines.join("\n")
		  		
		  		sassOpts = Object.assign({
		  			url: new URL(`file://${file.path}`)
		  		}, options.sass.options)

		  		outStyle = sass.compileString(sassContent, sassOpts).css
		  		styleLang = ""
		  	} catch (err) {
		  		console.error(`Error on copile coffee file ${file.path}: ${err}`)
		  		throw err
		  	}
	  	}
		}

	  var output = ""
	  output += "<template " + templateLang + ">" + "\n"
	  output += outTemplate + "\n"
	  output += "</template>" + "\n"
	  output += "\n"

	  output += "<script >" + "\n"
	  output += outScript + "\n"
	  output += "</script>" + "\n"
	  output += "\n"
	  output += "<style " + styleLang + " " + scopedStyle + ">" + "\n"
	  output += outStyle + "\n"
	  output += "</style>" + "\n"
	  return output
	}	

  return through.obj(transform)

}


function parse(input, tag, options) {
    var emptyExport = options && options.emptyExport !== undefined ? options.emptyExport : true;
    var node = getNode(input, tag, options);
    var parsed = padContent(node, input);
    // Add a default export of empty object if target tag script not found.
    // This fixes a TypeScript issue of "not a module".
    if (!parsed && tag === 'script' && emptyExport) {
        parsed = '// tslint:disable\nimport Vue from \'vue\'\nexport default Vue\n';
    }
    return parsed;
}

/**
 * Pad the space above node with slashes (preserves content line/col positions in a file).
 */
function padContent(node, input) {
    if (!node || !node.__location)
        return '';
    var nodeContent = input.substring(node.__location.startTag.endOffset, node.__location.endTag.startOffset);    
    return nodeContent;
}
/**
 * Get an array of all the nodes (tags).
 */
function getNodes(input) {
    var rootNode = parse5.parseFragment(input, { locationInfo: true });
    return rootNode.childNodes;
}/**
 * Get the node.
 */
function getNode(input, tag, options) {
    // Set defaults.
    var lang = options ? options.lang : undefined;
    // Parse the Vue file nodes (tags) and find a match.
    return getNodes(input).find(function (node) {
        var tagFound = tag === node.nodeName;
        var tagHasAttrs = ('attrs' in node);
        var langEmpty = lang === undefined;
        var langMatch = false;
        if (lang) {
            langMatch = tagHasAttrs && node.attrs.find(function (attr) {
                return attr.name === 'lang' && Array.isArray(lang)
                    ? lang.indexOf(attr.value) !== -1
                    : attr.value === lang;
            }) !== undefined;
        }
        return tagFound && (langEmpty || langMatch);
    });
}