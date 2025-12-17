# gulp-vue
Gulp vue compiller




## Compile CoffeeScript

	  gulp.src(path).pipe(vue(
	    removeBlankLines: true
	    coffee: {
	      compile: true
	      options: {
	        bare: true
	        sourcemap: true
	      }
	    }
	    pug: {
	      compile: false
	      options: {}
	    }
	    sass: {
	      compile: true
	      options: {}
	    }    
	  ).on('error', errorHandler)).pipe(gulp.dest(dest))