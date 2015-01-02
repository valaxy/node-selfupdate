var watch = require('watch')
var path = require('path')
var async = require('async')
var crypto = require('crypto')
var deferred = require('deferred')
var fs = require('fs')
var global = require('./global')


var download = function () {

}

var checksum = function (filePath) {
	var sha = crypto.createHash('sha256')
	var stream = fs.ReadStream(filePath)

	var def = deferred()
	stream.on('data', function (data) {
		sha.update(data)
	})
	stream.on('end', function () {
		var sum = sha.digest('hex')
		def.resolve(sum)
	})

	return def.promise
}


// get all the files in root, get their relative path
var fileTree = function (root, serverFiles, done) {
	watch.watchTree(root, function (files, curr, prev) {
		if (typeof files == 'object' && curr == null && prev == null) {
			watch.unwatchTree(root)
			var localFilePaths = []
			for (var absolutePath in files) {
				var stat = files[absolutePath]
				if (!stat.isDirectory()) {
					localFilePaths.push(path.relative(root, absolutePath))
				}
			}
			done(null, root, localFilePaths, serverFiles)
		}
	})
}


var calcDiff = function (root, localFilePaths, serverFiles, allDone) {
	var result = {}
	async.each(localFilePaths, function (localFilePath, done) {
		if (localFilePath in serverFiles) {
			checksum(path.join(root, localFilePath))(function (sum) {
				if (serverFiles[localFilePath] != sum) {
					result[localFilePath] = 'write'
				}
				delete serverFiles[localFilePath]
				done()
			})
		} else {
			result[localFilePath] = 'remove'
			done()
		}
	}, function () {
		// add new file
		for (var filePath in serverFiles) {
			result[filePath] = 'write'
		}
		allDone(null, result)
	})
}


// type: remove, write
var diff = function (root, serverFiles) {
	var def = deferred()
	async.waterfall([
		function (done) {
			done(null, root, serverFiles)
		},
		fileTree,
		calcDiff
	], function (err, result) {
		def.resolve(result)
	})
	return def.promise
}


// relative path
// uid
var update = function (root, serverFiles) {
	diff(root, serverFiles)(function (updateInfo) {
		download(updateInfo)
	})

}


if (global.test) {

	var temp = require('temp')
	var assert = require('assert')


	describe('update', function () {
		//describe('checksum()', function () {
		//	it('a sample', function (done) {
		//		var root = temp.mkdirSync('case')
		//		var filePath = path.join(root, 'file')
		//		fs.writeFileSync(filePath, 'hello node')
		//		checksum(filePath)(function (sum) {
		//			assert.equal(sum, 'c3f5abe3e11d87d645b9e9fda1bad6a8d2f9e54f7e81478138ac134ba7ac7280')
		//			done()
		//		})
		//	})
		//})
		//
		//
		//describe('fileTree()', function () {
		//	it('a sample', function (done) {
		//		var root = temp.mkdirSync('case')
		//		fs.writeFileSync(path.join(root, '1'), '1')
		//		fs.writeFileSync(path.join(root, '2'), '2')
		//		fs.writeFileSync(path.join(root, '3'), '3')
		//		fileTree(root, [] /* no use */, function (err, root, localFilePaths) {
		//			assert.equal(localFilePaths.length, 3)
		//			done()
		//		})
		//	})
		//})


		describe('diff', function () {
			it('a sample', function (done) {
				var root = temp.mkdirSync('local')
				fs.writeFileSync(path.join(root, '1'), 'hello node')
				fs.writeFileSync(path.join(root, '2'), '2')
				fs.mkdirSync(path.join(root, 'a'))
				fs.writeFileSync(path.join(root, 'a', '3'), '3')

				diff(root, {
					'1': 'c3f5abe3e11d87d645b9e9fda1bad6a8d2f9e54f7e81478138ac134ba7ac7280',
					'2': '123', // '123' can not be real cheksum
					'a/3': '123'
				})(function (diffFiles) {
					var ax = {'1': 'a', '2': 'b'}
					console.log(diffFiles['2'])
					var a = Object.keys(diffFiles)
					console.log(a)
					var b = a.length
					console.log(b)
					assert.equal(ax['1'], 1)
					done()

					assert.equal(diffFiles['2'], 'write')
					//assert.equal(diffFiles['a/3'], 'write')
				}).done()
			})
		})
	})

}

exports.update = update