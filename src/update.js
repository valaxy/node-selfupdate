var watch = require('watch')
var path = require('path')
var async = require('async')
var crypto = require('crypto')
var deferred = require('deferred')
var fs = require('fs')
var global = require('./global')


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


var download = function () {

}


// type: remove, write
var diff = function (root, serverFiles) {
	var def = deferred()
	async.waterfall([
		function (done) {
			watch.watchTree(root, function (files, curr, prev) {
				if (typeof files == 'object' && curr == null && prev == null) {
					watch.unwatchTree(root)
					var localFiles = []
					for (var absolutePath in files) {
						var stat = files[absolutePath]
						if (!stat.isDirectory()) {
							localFiles.push(absolutePath)
						}
					}
					done(null, localFiles)
				}
			})
		},
		function (done, localFiles) {
			var result = {}
			var j = 0
			for (var i = 0; i < localFiles.length; i++) {
				var localFilePath = localFiles[i]
				if (localFilePath in serverFiles) {
					checksum(localFilePath)(function (sum) {
						if (serverFiles[localFilePath] != sum) {
							result[localFilePath] = 'write'
						}
						delete serverFiles[localFilePath]
					})
				} else {
					result[localFilePath] = 'remove'
				}
			}

			// add new file
			for (var filePath in serverFiles) {
				result[filePath] = 'write'
			}

			done(result)
		}
	], function (err, result) {
		def.resolve(result)
	})
	return def.promise
}


// relative path
// uid
var update = function (root, serverFiles) {
	diff(root, serverFiles, function (updateInfo) {
		download(updateInfo)
	})

}


if (global.test) {

	var temp = require('temp')
	var assert = require('assert')


	describe('update', function () {
		describe('checksum', function () {
			it('a sample', function (done) {
				var root = temp.mkdirSync('case')
				var filePath = path.join(root, 'file')
				fs.writeFileSync(filePath, 'hello node')
				checksum(filePath)(function (sum) {
					assert.equal(sum, 'c3f5abe3e11d87d645b9e9fda1bad6a8d2f9e54f7e81478138ac134ba7ac7280')
					done()
				})
			})
		})


		describe('diff', function () {
			it('test diff', function () {
				var root = temp.mkdirSync('local')
				fs.writeFileSync(path.join(root, '1'), '1')
				fs.writeFileSync(path.join(root, '2'), '2')
				fs.mkdirSync(path.join(root, 'a'))
				fs.writeFileSync(path.join(root, 'a', '3'), '3')

				diff(root, {
					'/1': '123',    // '123' can not be cheksum
					'/2': '123',
					'/a/3': '123'
				})(function (diffFiles) {
					assert.equal(diffFiles['1'], 'write')
					assert.equal(diffFiles['2'], 'write')
					assert.equal(diffFiles['3'], 'write')
				})
			})
		})
	})

}

exports.update = update