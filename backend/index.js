const { GraphQLServer } = require('graphql-yoga')
const mongoose = require('mongoose'), Schema = mongoose.Schema
// const UserSchema = require('./User').schema;
// const PlaceSchema = require('./Place').schema;

// Connect to the 'testPlacesDb' database
mongoose.connect("mongodb://localhost/testPlacesDb")

// Defining the database schema
const User = mongoose.model("User", {
	name: String
});

const typeDefs = `
  type Query {
    hello(name: String): String!
  }
  type User {
	id: ID!
	name: String!
  }
  type Mutation {
	createUser(name: String!): User!
  }
`;

const resolvers = {
  Query: {
    hello: (_, { name }) => `Hello ${name || 'World'}`,
  },
  Mutation: {
	createUser: async (_, { name }) => {
		const user = new User({ name });
		await user.save(); // Adds the new user to the database
		return user;
	}
  }
};

const server = new GraphQLServer({ typeDefs, resolvers })
// Start the server once the database connection has been established
mongoose.connection.once("open", function() {
	server.start(() => console.log('Server is running on localhost:4000'))
});