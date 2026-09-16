const path = require('path');  
module.exports = (request, options) => {  
  if ((request.startsWith('./') || request.startsWith('../')) && request.endsWith('.js')) {  
    const basedir = options.basedir || '';  
    if (basedir.includes(path.sep + 'src') || basedir.includes(path.sep + 'tests')) {  
      const tsRequest = request.slice(0, -3) + '.ts';  
      try { return options.defaultResolver(tsRequest, options); } catch (e) {}  
    }  
  }  
  return options.defaultResolver(request, options);  
}; 
