var path = require('path'),
	gulp = require('gulp'),
	gutil = require('gulp-util'),
	through2 = require('through2'),
	assert = require('assert'),
	hash = require('../index.js'),
	fs = require('fs');

describe('hash.manifest()', function() {
	it('should generate valid manifest file', function(done) {
		gulp.src(__dirname + '/fixture.txt')
			.pipe(hash({
				algorithm: 'sha1',
				hashLength: 8
			}))
			.pipe(hash.manifest(''))
			.pipe(through2.obj(function(file) {
				assert.equal(file.contents.toString(), JSON.stringify({
					"fixture.txt": "fixture-1d229271.txt"
				}));
				done();
			}));
	});

	it('should support changing output paths', function(done) {
		gulp.src(__dirname + '/fixture.txt')
			.pipe(hash({
				algorithm: 'sha1',
				hashLength: 8,
				template: 'out/<%= name %>-<%= hash %><%= ext %>'
			}))
			.pipe(hash.manifest(''))
			.pipe(through2.obj(function(file) {
				var err = null;
				try {
					assert.equal(file.contents.toString(), JSON.stringify({
						"fixture.txt": "out/fixture-1d229271.txt"
					}));
				} catch(e) { err = e; }
				done(err);
			}));
	});

	it('the append option should work and use a queue', function(done) {
		var fakeFile = new gutil.File({
			contents: new Buffer('Hello'),
			path: 'file-f7ff9e8b.txt'
		});

		fakeFile.origPath = 'file.txt';

		var fakeFile2 = new gutil.File({
			contents: new Buffer('Hello'),
			path: 'foo-123.txt'
		});

		fakeFile2.origPath = 'foo.txt';

		var fakeFile3 = new gutil.File({
			contents: new Buffer('Hello'),
			path: 'foo-456.txt'
		});

		fakeFile3.origPath = 'foo.txt';

		// First this sets manifest content to {"file.txt":"file-f7ff9e8b.txt"}
		var manifestStream = hash.manifest('a', true);

		manifestStream.write(fakeFile);
		manifestStream.end();

		// {"file.txt":"file-f7ff9e8b.txt","foo.txt":"foo-123.txt"}
		var stream2 = hash.manifest('a', true);
		stream2.write(fakeFile2);
		stream2.end();

		// {"file.txt":"file-f7ff9e8b.txt","foo.txt":"foo-456.txt"} (overwriting the previous foo)
		var stream3 = hash.manifest('a', true);

		stream3.once('data', function(file) {
			var err = null;

			try {
				// The order here is important, foo.txt should have foo-456 as its value
				assert.equal(file.contents.toString(), '{"file.txt":"file-f7ff9e8b.txt","foo.txt":"foo-456.txt"}');
			} catch (e) { err = e; }

			done(err);
		});

		stream3.write(fakeFile3);
		stream3.end();
	});

	it('should delete old processed filed if original file was changed', function(done) {
    var originalContent = 'Original content';
    var changedContent = 'Changed content';
		var outputDirPath = __dirname + '/temp';
		var filePath = outputDirPath + '/test_file.txt';
		var firstOutputPath = outputDirPath + '/test_file-b9d5922c.txt';
		var secondOutputPath = outputDirPath + '/test_file-93d79001.txt';

		var cleanup = function() {
      fs.existsSync(firstOutputPath) && fs.unlinkSync(firstOutputPath);
      fs.existsSync(secondOutputPath) && fs.unlinkSync(secondOutputPath);
      fs.existsSync(filePath) && fs.unlinkSync(filePath);
		};

    cleanup();

    fs.writeFileSync(filePath, originalContent);

    gulp.src(filePath)
      .pipe(hash())
      .pipe(gulp.dest(outputDirPath))
      .pipe(hash.manifest('a'))

      .pipe(through2.obj(function() {
        fs.writeFileSync(filePath, changedContent);

        gulp.src(filePath)
          .pipe(hash())
        	.pipe(gulp.dest(outputDirPath))
          .pipe(hash.manifest('a', {
          	deleteOld: true,
            sourceDir: (outputDirPath)
					}))
          .pipe(through2.obj(function() {
            var err = null;

            try {
              assert.equal(fs.existsSync(firstOutputPath), false, 'First file should be delete');
              assert.equal(fs.readFileSync(secondOutputPath), changedContent, 'Second file should have correct content');
            } catch (e) { err = e; }

            cleanup();
            done(err);
          }));
      }));
	})
});
