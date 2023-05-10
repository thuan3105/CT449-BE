const express = require("express");
const app = express();
const config = require("./app/config");
const MongoDB = require("./app/utils/mongodb.util");
const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
app.use(express.json());
async function startServer() {
  try {
    const client = await MongoDB.connect(config.db.uri);
    console.log("Connected to MongoDB");
    app.get("/api/products", async (req, res) => {
      try {
        const db = client.db();
        const products = await db.collection("products").find({}).toArray();
        res.status(200).json(products);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    app.post("/api/products", async (req, res) => {
      try {
        const db = client.db();
        const product = req.body;
        console.log(product);
        const result = await db.collection("products").insertOne(product);
        res.status(201).json(result.ops[0]);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    app.patch("/api/products/:productId", async (req, res) => {
      try {
        const db = client.db();
        const productId = req.params.productId;
        const product = req.body;
        console.log(productId);
        console.log(product);
        const result = await db
          .collection("products")
          .updateOne({ id: productId }, { $set: product });
        if (result.modifiedCount === 0) {
          res.status(404).json({ message: "Product not found" });
        } else {
          res.status(200).json({ message: "Product updated" });
        }
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    app.get("/api/users", async (req, res) => {
      try {
        const db = client.db();
        const users = await db.collection("users").find({}).toArray();
        res.status(200).json(users);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    app.delete("/api/users/:userId", async (req, res) => {
      try {
        const { userId } = req.params;
        const db = client.db();
        const result = await db
          .collection("users")
          .findOneAndDelete({ id: userId });
        if (result.value) {
          res
            .status(200)
            .json({ message: `User with ID ${userId} has been deleted` });
        } else {
          res.status(404).json({ message: `User with ID ${userId} not found` });
        }
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.patch("/api/users/:userId", async (req, res) => {
      try {
        const db = client.db();
        const userId = req.params.userId;
        const user = req.body;
        console.log(userId);
        console.log(user);
        const result = await db
          .collection("users")
          .updateOne({ id: userId }, { $set: user });
        if (result.modifiedCount === 0) {
          res.status(404).json({ message: "User not found" });
        } else {
          res.status(200).json({ message: "User updated" });
        }
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/api/users/:userId/cart", async (req, res) => {
      const { userId } = req.params;
      try {
        const db = client.db();
        const user = await db.collection("users").findOne({ id: userId });
        if (!user) return res.status(404).json("Conuld not find user!");
        const products = await db.collection("products").find({}).toArray();
        const cartItemIds = user.cartItems;
        const cartItems = cartItemIds.map((cartitem) => {
          product = products.find(
            (product) => product.id === cartitem.productId
          );
          return { product, quantity: cartitem.quantity };
        });
        res.status(200).json(cartItems);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    app.get("/api/products/:productId", async (req, res) => {
      const { productId } = req.params;
      const db = client.db();
      const products = await db.collection("products").find({}).toArray();
      const product = products.find((product) => product.id === productId);
      if (product) {
        res.status(200).json(product);
      } else {
        res.status(404).json("Could not find the product!");
      }
    });
    app.get("/api/products/search/:searchTerm", async (req, res) => {
      const { searchTerm } = req.params;
      const db = client.db();
      const products = await db
        .collection("products")
        .find({
          name: { $regex: searchTerm, $options: "i" },
        })
        .toArray();
      if (products.length > 0) {
        res.status(200).json(products);
      } else {
        res.status(404).json("Could not find any products!");
      }
    });

    app.post("/api/users/:userId/cart", async (req, res) => {
      try {
        const { userId } = req.params;
        const { productId } = req.body || {};
        const quantity = "1";
        console.log(quantity);
        if (!productId) {
          return res
            .status(400)
            .json({ message: "productId is missing from the request body" });
        }
        const db = client.db();
        await db.collection("users").updateOne(
          { id: userId },
          {
            $addToSet: { cartItems: { productId, quantity: quantity } },
          },
          { upsert: true } // create a new document if it doesn't exist
        );
        const user = await db.collection("users").findOne({ id: userId });
        const products = await db.collection("products").find({}).toArray();
        const cartItemIds = user.cartItems;
        const cartItems = cartItemIds.map((id) =>
          products.find((product) => product.id === id)
        );
        res.status(200).json(cartItems);
      } catch (error) {
        console.log(error);
        res.status(404).json({ message: "Could not find the product!" });
      }
    });
    app.delete("/api/users/:userId/cart/:productId", async (req, res) => {
      try {
        const { userId, productId } = req.params;
        const db = client.db();
        await db.collection("users").updateOne(
          { id: userId },
          {
            $pull: { cartItems: { productId: productId } },
          }
        );
        const user = await db.collection("users").findOne({ id: userId });
        const cartItemIds = user.cartItems;
        const products = await db.collection("products").find({}).toArray();
        const cartItems = cartItemIds.map((cartItem) => {
          const product = products.find(
            (product) => product.id === cartItem.productId
          );
          return {
            product,
            quantity: cartItem.quantity,
          };
        });
        res.status(200).json(cartItems);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.patch("/api/users/:userId/cart/:productId", async (req, res) => {
      try {
        const { userId, productId } = req.params;
        const { quantity } = req.body;
        console.log(quantity);
        const db = client.db();
        await db
          .collection("users")
          .updateOne(
            { id: userId, "cartItems.productId": productId },
            { $set: { "cartItems.$.quantity": quantity } }
          );
        const user = await db.collection("users").findOne({ id: userId });
        const cartItemIds = user.cartItems;
        console.log(cartItemIds);
        const products = await db.collection("products").find({}).toArray();
        const cartItems = cartItemIds.map((item) =>
          products.find((product) => product.id === item.productId)
        );
        res.status(200).json(cartItems);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/api/products/:productId", async (req, res) => {
      try {
        const { productId } = req.params;
        const db = client.db();
        const result = await db
          .collection("products")
          .findOneAndDelete({ id: productId });
        if (result.value) {
          res
            .status(200)
            .json({ message: `Product with ID ${productId} has been deleted` });
        } else {
          res
            .status(404)
            .json({ message: `Product with ID ${productId} not found` });
        }
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    app.get("/api/orders", async (req, res) => {
      const db = client.db();
      const orders = await db.collection("orders").find({}).toArray();
      res.status(200).json(orders);
    });

    app.get("/api/users/:userId/orders", async (req, res) => {
      const { userId } = req.params;
      const db = client.db();
      const orders = await db.collection("orders").find({ userId }).toArray();
      res.status(200).json(orders);
    });
    app.post("/api/users/:userId/orders", async (req, res) => {
      const { userId } = req.params;
      const { name, email, address, cartItems, totalPrice } = req.body;
      const db = client.db();
      const date = new Date();
      const dateNow = date.toISOString().slice(0, -14);
      const order = {
        userId: userId,
        name: name,
        email: email,
        address: address,
        cartItems: cartItems,
        totalPrice: totalPrice,
        date: dateNow,
      };
      const result = await db.collection("orders").insertOne(order);
      res.status(200).json(result);
    });
    app.post(
      "/api/signup",
      [
        body("name").notEmpty().withMessage("Name is required"),
        body("email").isEmail().withMessage("Invalid email").normalizeEmail(),
        body("password")
          .isLength({ min: 6 })
          .withMessage("Password must be at least 6 characters"),
      ],

      async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(422).json({ errors: errors.array() });
        }

        try {
          const db = client.db();
          const existingUser = await db
            .collection("users")
            .findOne({ email: req.body.email });
          if (existingUser) {
            return res
              .status(409)
              .json({ message: "User with this email already exists" });
          }
          const hashedPassword = await bcrypt.hash(req.body.password, 10);

          const cartItems = [];
          const newUser = {
            id: uuidv4(),
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            isAdmin: req.body.isAdmin,
            cartItems: cartItems,
          };
          const result = await db.collection("users").insertOne(newUser);
          res.status(200).json(result);
        } catch (error) {
          console.log(error);
          res.status(500).json({ message: "Internal server error" });
        }
      }
    );
    app.post("/api/login", async (req, res) => {
      try {
        const db = client.db();
        const user = await db
          .collection("users")
          .findOne({ email: req.body.email });
        if (!user) {
          return res.status(401).json({ message: "Invalid email or password" });
        }
        const validPassword = await bcrypt.compare(
          req.body.password,
          user.password
        );
        if (!validPassword) {
          return res.status(401).json({ message: "Invalid email or password" });
        }
        const result = {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
        };
        res.status(200).json({ result });
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    app.listen(config.app.port, () => {
      console.log(`Server is running on port ${config.app.port}`);
    });
  } catch (error) {
    console.log("Cannot connect to MongoDB", error);
    process.exit();
  }
}
startServer();
