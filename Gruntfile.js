
module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  var base_sources = ['js/reMarked.js',
                      'js/showdown.js',
                      'js/jquery.autogrow.js',
                      'js/moleskine.js',
                      'js/moleskine.conf.js'];

  var angular_sources = ['js/reMarked.js',
      'js/showdown.js',
      'js/jquery.autogrow.js',
      'js/moleskine.js',
      'js/moleskine.conf.js',
      'js/moleskine-angular.js'];
  
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat : {
      options: {
        separator: ';'
      },
      dist: {
        src: angular_sources,
        dest: 'dist/moleskin-angular.js'
      }
    },
    uglify: {
      options: {
        separator: ';',
        stripBanners : true,
        banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
          '<%= grunt.template.today("yyyy-mm-dd") %> */'
      },
      dist: {
        src: base_sources,
        dest: 'dist/moleskin.min.js'
      },
      angular_dist : {
        src: angular_sources,
        dest: 'dist/moleskin-angular.min.js'
      }
    },
    watch: {
      scripts: {
        files: ['js/*.js'],
        tasks: ['compile'],
        options: {
          nospawn: true
        }
      }
    }
  });

  grunt.registerTask('default', ['compile', 'watch']);

  grunt.registerTask('compile', ['uglify:dist',
                                 'concat:dist',
                                 'uglify:angular_dist']);

};
