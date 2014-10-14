var gulp = require('gulp');
var useref = require('gulp-useref');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var minifyCss = require('gulp-minify-css');
var merge = require('merge-stream');
var del = require('del');
var replace = require('gulp-replace');

gulp.task('build', ['clean'], function() {

  var assets = useref.assets();

  var base = gulp.src('src/index.html')
    .pipe(assets)
    .pipe(gulpif('*.js', uglify()))
    .pipe(gulpif('*.css', minifyCss()))
    .pipe(assets.restore())
    .pipe(useref())
    .pipe(gulp.dest('dist'));

  var cache = gulp.src('src/cache.manifest')
    .pipe(replace('{{buildNumber}}', Date.now()))
    .pipe(gulp.dest('dist'));

  var manifest = gulp.src('src/manifest.webapp')
    .pipe(gulp.dest('dist'));

  var img = gulp.src('src/img/**')
    .pipe(gulp.dest('dist/img'));

  var fonts = gulp.src('src/bower_components/bootstrap/dist/fonts/**')
    .pipe(gulp.dest('dist/fonts'));

  return merge(cache, manifest, img, fonts);

});

gulp.task('clean', function(cb) {
  del(['dist'], cb);
});

gulp.task('default', ['build']);
