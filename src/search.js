var lunr = require('lunr')

function Search() {
  var self = Object.create(Search.prototype)
  self.index = lunr(function() {
    this.field('name'        , { boost: 10 })
    this.field('description' , { boost:  4 })
    this.field('author'      , { boost:  6 })
    this.field('readme')
  })
  return self
}

Search.prototype.query = function(q) {
  return this.index.search(q)
}

Search.prototype.add = function(pgk) {
  this.index.add({
    id:           pgk.name,
    name:         pgk.name,
    description:  pgk.description,
    author:       pgk._npmUser ? pgk._npmUser.name : '???',
  })
},

Search.prototype.remove = function(name) {
  this.index.remove({ id: name })
}

Search.prototype.reindex = function() {
  var self = this
  this.storage.get_local(function(err, packages) {
    if (err) throw err // that function shouldn't produce any
    var i = packages.length
    while (i--) {
      self.add(packages[i])
    }
  })
}

Search.prototype.configureStorage = function(storage) {
  this.storage = storage
  this.reindex()
}

module.exports = Search()

