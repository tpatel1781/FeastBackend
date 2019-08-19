var express = require('express');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var app = express();
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())
mongoose.set('useFindAndModify', false);

var port = process.env.PORT || 4000;

// Connect to the 'testPlacesDb' database
// mongoose.connect("mongodb://localhost/testPlacesDb");
mongoose.connect("mongodb+srv://user:rDZYNBtxxA20RCt7@cluster0-dhybl.mongodb.net/test?retryWrites=true&w=majority");

// Define data schema
var PlaceSchema = new Schema({
	googleID: String,
	name: String,
	rating: Number,
	visitedDate: Date
});
var UserSchema = new Schema({
	_id: String,
	name: String,
	email: String,
	visitedPlaces: [PlaceSchema],
	groupIDs: [String]
});
var GroupSchema = new Schema({
	name: String,
	users: [String],
	visitedPlaces: [PlaceSchema],
	messages: [mongoose.Mixed],
	isPollOpen: Boolean
});
var Place = mongoose.model('Place', PlaceSchema);
var User = mongoose.model('User', UserSchema);
var Group = mongoose.model('Group', GroupSchema);

UserSchema.index({ _id: 1 }, { collation: { locale: 'en', strength: 2 } })

// API Routes
app.post('/addUser', async function (req, res) {
	var user = new User({ _id: req.body.username, name: req.body.name, email: req.body.email, visitedPlaces: [], groups: [[]] });
	await User.find({ email: req.body.email }, async function (err, results) {
		if (err || results.length) {
			console.log(err);
			console.log(results);
			res.status(400).send("Must choose an email that has not been taken by another user");
		} else {
			await user.save(function (err) {
				if (err) {
					console.log("Error: " + err);
					res.status(400).send("Must choose a username that has not been taken by another user");
				} else {
					res.send(user);
					console.log('Added user ' + req.body.name);
				}
			});
		}
	});
});
app.post('/addGroup', async function (req, res) {
	var group = new Group({ name: req.body.name, users: req.body.group, visitedPlaces: [], isPollOpen: false });
	var error = false;
	var invalidUsers = [];
	// Check that all of the usernames given are registered users
	for (const username of req.body.group) {
		await User.findOne({ _id: username }, function (err, result) {
			if (err || !result) {
				error = true;
				invalidUsers.push(username);
			}
		});
	}
	if (error) {
		res.status(404).send("Error: Could not find user(s): " + invalidUsers);
	} else {
		// All of the usernames in the given list are registered users
		await group.save(function (err) { if (err) return res.send(err); });
		// Add the group ID to each user. Frontend ensures the same user cannot be added to a group multiple times
		req.body.group.forEach(async function (username) {
			await User.findOneAndUpdate({ _id: username }, { $push: { groupIDs: group._id.toString() } });
		});
		return res.send(group)
	}
});
app.delete('/removeGroup', async function (req, res) {
	var group = await Group.findOne({ _id: req.body.groupID });
	group.users.forEach(async function (username) {
		await User.findOneAndUpdate({ _id: username }, { $pull: { groupIDs: req.body.groupID } });
	});

	await Group.findOneAndRemove({ _id: req.body.groupID });
	res.send("Successfully removed group " + req.body.groupID);
});
app.get('/getGroup', async function (req, res) {
	await Group.findOne({ _id: req.query.groupID }, async function (err, results) {
		if (err || !results) {
			res.status(404).send('Cannot find group: \'' + req.query.groupID + '\'');
		} else {
			res.send(results);
		}
	});
});
app.post('/updatePoll', async function (req, res) {
	await Group.findOneAndUpdate({ _id: req.body.groupID }, { isPollOpen: req.body.pollState });
	res.send("Poll state is now " + req.body.pollState);
})
app.get('/getUser', async function (req, res) {
	await User.findOne({ _id: req.query.username }, async function (err, results) {
		if (err || !results) {
			res.status(404).send('Cannot find user: \'' + req.query.username + '\'');
		} else {
			res.send(results);
		}
	}).collation({ locale: 'en', strength: 2 });
});
app.post('/addPlace', async function (req, res) {
	await User.findOne({ _id: req.body.username }, async function (err, results) {
		if (err) return err;
		const correctPlace = []
		// Get the list of existing places
		results.visitedPlaces.forEach(place => {
			if (place.googleID === req.body.googleID) { correctPlace.push(place); }
		});
		if (!correctPlace.length) {
			// User does not already have this place, add it to visitedPlaces
			var place = new Place({ googleID: req.body.googleID, name: req.body.name, rating: req.body.rating });
			await User.findOneAndUpdate({ _id: req.body.username }, { $push: { visitedPlaces: place } });
			res.send('Added place (Google ID): ' + req.body.googleID + ' to user ' + req.body.username);
		} else {
			// User already has this place, update existing item
			await User.findOneAndUpdate({ "visitedPlaces.googleID": req.body.googleID, _id: req.body.username }, {
				$set: {
					'visitedPlaces.$.name': req.body.name,
					'visitedPlaces.$.rating': req.body.rating
				}
			});
			res.send('Updated place (Google ID): ' + req.body.googleID + ' for user ' + req.body.username);
		}
	});
});
app.delete('/removePlace', async function (req, res) {
	await User.update({ _id: req.body.username }, { $pull: { visitedPlaces: { googleID: req.body.googleID } } });
	res.send('Successfully removed place (Google ID): ' + req.body.googleID);
});
app.post('/addGroupPlace', async function (req, res) {
	await Group.findOne({ _id: req.body.groupID }, async function (err) {
		if (err) res.send('Invalid groupID');

		// Group does not already have this place, add it to visitedPlaces
		const date = (!req.body.visitedDate) ? new Date() : new Date(parseFloat(req.body.visitedDate));
		console.log("My Date: " + date);
		var place = new Place({ googleID: req.body.googleID, name: req.body.name, rating: req.body.rating, visitedDate: date });
		await Group.findOneAndUpdate({ _id: req.body.groupID }, { $push: { visitedPlaces: place } });
		res.send('Added place (Google ID): ' + req.body.googleID + ' to group ' + req.body.groupID);

	});
});
app.post('/addMessageToGroup', async function (req, res) {
	await Group.findOne({ _id: req.body.groupID }, async function (err) {
		if (err) res.send('Invalid groupID');

		await Group.findOneAndUpdate({ _id: req.body.groupID }, { $push: { messages: { $each: req.body.message, $position: 0 } } });
		res.send(req.body.message);
	});
});
app.post('/editGroupName', async function (req, res) {
	await Group.findOne({ _id: req.body.groupID }, async function (err) {
		if (err) res.send('Invalid groupID');

		await Group.findOneAndUpdate({ _id: req.body.groupID }, { name: req.body.name });
		res.send("Successfully changed group name to " + req.body.name);
	});
});
app.post('/addUserToGroup', async function (req, res) {
	await User.findOne({ _id: req.body.username }, async function (err, results) {
		if (err || !results) { // If the user does not already exist
			res.send("Could not add user " + req.body.username);
		} else {
			// User exists, frontend will prevent a user being added multiple times
			await Group.findOne({ _id: req.body.groupID }, async function (err) {
				if (err) res.send("Invalid groupID");
		
				await Group.findOneAndUpdate({ _id: req.body.groupID }, { $push: {users: req.body.username } });
				res.send("Successfully added " + req.body.username + " to group " + req.body.groupID);
			});
		}
	});
});
app.delete('/removeUserFromGroup', async function(req, res) {
	await User.findOne({ _id: req.body.username }, async function (err, results) {
		if (err || !results) {
			res.send("Could not remove user " + req.body.username);
		} else {
			await Group.findOne({ _id: req.body.groupID }, async function (err) {
				if (err) res.send('Invalid groupID');

				await Group.findOneAndUpdate({ _id: req.body.groupID }, { $pull: { users: req.body.username }});
				res.send('Successfully removed user ' + req.body.username + ' from group');
			});
		}
	});
});

mongoose.connection.once("open", function () {
	// Start the server
	app.listen(port);
	console.log('Server started at port ' + port);
});