const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const dbAdmin = process.env.TASKOLOGY_USER;
const dbPassWord = process.env.TASKOLOGY_PASSWORD;

const uri = `mongodb+srv://${dbAdmin}:${dbPassWord}@cluster0.bndsovl.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const dbConnect = async () => {
  try {
    client.connect();
    console.log('DB connected successfully');
  } catch (error) {
    console.log(error.message);
  }
}
dbConnect();

    const db = client.db("taskologyDB");
    const usersCollection = db.collection("users");
    const blogsCollection = db.collection("blogs");

    app.get("/", (req, res) => {
      res.send("Taskology server running successfully!");
    });

    //jwt api
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    //all users related api


    app.get("/loggedUser/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      const result = await usersCollection.findOne(query);
      console.log(result);
      res.send(result);
    });

    app.get("/allBlogs", async (req, res) => {
      const result = await blogsCollection.find().toArray();
      res.send(result);
    });

    app.get("/alloBlogs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.findOne(query);
      res.send(result);
    });


    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/users/profile/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const userInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: userInfo,
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Admin related apis

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      const user = await usersCollection.findOne(query);
      let userStatus = false;
      if (user) {
        userStatus = user?.status === "active";
      }
      res.send({ userStatus });
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/blogs", verifyToken, verifyAdmin, async (req, res) => {
      const result = await blogsCollection.find().toArray();
      res.send(result);
    });

    app.post("/addBlog", verifyToken, verifyAdmin, async (req, res) => {
      const blog = req.body;
      const result = await blogsCollection.insertOne(blog);
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = req.query.role;
        const filter = { _id: new ObjectId(id) };
        let updatedDoc = {};
        if (query === "admin") {
          updatedDoc = {
            $set: {
              role: "user",
            },
          };
        } else if (query === "user") {
          updatedDoc = {
            $set: {
              role: "admin",
            },
          };
        }
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.patch("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const query = req.query.status;
      let updatedDoc = {};
      if (query === "active") {
        updatedDoc = {
          $set: {
            status: "blocked",
          },
        };
      } else if (query === "blocked") {
        updatedDoc = {
          $set: {
            status: "active",
          },
        };
      }

      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });


    app.delete("/blogs/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.deleteOne(query);
      res.send(result);
    });

app.listen(port, () => {
  console.log(`Taskology server running on port ${port}`);
});
