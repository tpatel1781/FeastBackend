var express = require('express');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())
mongoose.set('useFindAndModify', false);

var port = 4000;

// Connect to the 'testPlacesDb' database
mongoose.connect("mongodb://localhost/testPlacesDb");

// Define data schema
var PlaceSchema = new Schema({
  googleID: String,
  name: String,
  rating: Number
});
var UserSchema = new Schema({
  name: String,
  visitedPlaces: [PlaceSchema]
});
var Place = mongoose.model('Place', PlaceSchema);
var User = mongoose.model('User', UserSchema);

// API Routes
app.post('/addUser', async function(req, res) {
  var user = new User({ name: req.body.name, visitedPlaces: [] });
  await user.save();
  res.send(user);
  console.log('Added user ' + req.body.name);
});
app.post('/addPlace', async function(req, res) {
  await User.findOne({ _id: req.body.userID }, async function(err, results) {
    if (err) return err;
    const correctPlace = []
    // Get the list of existing 
    results.visitedPlaces.forEach(place => {
      if (place.googleID === req.body.googleID) {
        correctPlace.push(place);
        break;
      }
    });
    if (!correctPlace.length) {
      // User does not already have this place, add it to visitedPlaces
      console.log("User does not already have this place");
      var place = new Place({ googleID: req.body.googleID, name: req.body.name, rating: req.body.rating });
      await User.findOneAndUpdate({ _id: req.body.userID }, { $push: { visitedPlaces: place }});
    } else {
      // User already has this place, update existing item
      console.log("User already has this place");
      await User.findOneAndUpdate({ "visitedPlaces.googleID": req.body.googleID, _id: req.body.userID }, {$set: {
        'visitedPlaces.$.name': req.body.name,
        'visitedPlaces.$.rating': req.body.rating
      }})
    }
  });
  res.send('Added place ' + req.body.name + ' to user ' + req.body.userID);
});
app.delete('/removePlace', async function(req, res) {
  await User.update( { _id: req.body.userID }, { $pull: { visitedPlaces: { _id: req.body.placeID }}});
  res.send('Successfully removed place');
});

mongoose.connection.once("open", function() {
  // Start the server
  app.listen(port);
  console.log('Server started at port ' + port);
});