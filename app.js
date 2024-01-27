const express = require("express");
const bodyParser = require("body-parser");
const { Sequelize, DataTypes } = require("sequelize");

const app = express();
const port = 3000;

// Use body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const sequelize = new Sequelize({
  dialect: "postgres",
  host: "postgres",
  username: "postgres",
  password: "postgres",
  database: "qp_assessment",
});

const Grocery = sequelize.define("Grocery", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  inventory: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

// API endpoints for Admin
app.post("/admin/add_grocery", async (req, res) => {
  try {
    const { name, price, inventory } = req.body;
    const newGrocery = await Grocery.create({ name, price, inventory });
    res.json({ message: "Grocery item added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/admin/view_groceries", async (req, res) => {
  try {
    const groceries = await Grocery.findAll();
    const groceryList = groceries.map((item) => ({
      name: item.name,
      price: item.price,
      inventory: item.inventory,
    }));
    res.json({ groceries: groceryList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/admin/delete_grocery/:id", async (req, res) => {
  try {
    const groceryId = req.params.id;

    // Find the grocery item in the database
    const groceryItem = await Grocery.findByPk(groceryId);

    // If the grocery item exists, delete it
    if (groceryItem) {
      await groceryItem.destroy();
      res.json({ message: "Grocery item deleted successfully" });
    } else {
      res.status(404).json({ error: "Grocery item not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/admin/update_grocery/:id", async (req, res) => {
  try {
    const groceryId = req.params.id;

    // Find the grocery item in the database
    const groceryItem = await Grocery.findByPk(groceryId);

    // If the grocery item exists, update it
    if (groceryItem) {
      const { name, price, inventory } = req.body;

      // Update the grocery item's properties
      groceryItem.name = name || groceryItem.name;
      groceryItem.price = price || groceryItem.price;
      groceryItem.inventory = inventory || groceryItem.inventory;

      // Save the changes to the database
      await groceryItem.save();

      res.json({ message: "Grocery item updated successfully" });
    } else {
      res.status(404).json({ error: "Grocery item not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/admin/manage_inventory/:id", async (req, res) => {
  try {
    const groceryId = req.params.id;

    // Find the grocery item in the database
    const groceryItem = await Grocery.findByPk(groceryId);

    // If the grocery item exists, update its inventory
    if (groceryItem) {
      const { quantity, action } = req.body;

      // Validate action (increase or decrease)
      if (action === "increase") {
        groceryItem.inventory += quantity;
      } else if (action === "decrease") {
        // Ensure inventory doesn't go below 0
        groceryItem.inventory = Math.max(0, groceryItem.inventory - quantity);
      } else {
        return res
          .status(400)
          .json({ error: 'Invalid action. Use "increase" or "decrease".' });
      }

      // Save the changes to the database
      await groceryItem.save();

      res.json({ message: "Inventory managed successfully" });
    } else {
      res.status(404).json({ error: "Grocery item not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// API endpoints for User
app.get("/user/view_available_groceries", async (req, res) => {
  try {
    const groceries = await Grocery.findAll({
      where: {
        inventory: { [Sequelize.Op.gt]: 0 },
      },
    });
    const availableGroceries = groceries.map((item) => ({
      name: item.name,
      price: item.price,
    }));
    res.json({ available_groceries: availableGroceries });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/user/book_order", async (req, res) => {
  try {
    const { groceries } = req.body;

    // Ensure that the request body contains a list of groceries
    if (!groceries || !Array.isArray(groceries) || groceries.length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid request body. Provide a list of groceries." });
    }

    // Find all groceries by their IDs
    const groceryItems = await Grocery.findAll({
      where: {
        id: groceries.map((g) => g.id),
      },
    });

    // Validate that all requested groceries exist
    const missingGroceries = groceries.filter(
      (g) => !groceryItems.some((item) => item.id === g.id)
    );
    if (missingGroceries.length > 0) {
      return res
        .status(404)
        .json({ error: "One or more requested groceries do not exist." });
    }

    // Check inventory levels and update
    for (const requestedItem of groceries) {
      const groceryItem = groceryItems.find(
        (item) => item.id === requestedItem.id
      );

      if (groceryItem.inventory < requestedItem.quantity) {
        return res
          .status(400)
          .json({ error: `Insufficient inventory for ${groceryItem.name}.` });
      }

      // Decrease inventory based on the booked quantity
      groceryItem.inventory -= requestedItem.quantity;

      // Save changes to the database
      await groceryItem.save();
    }

    // Order booking successful
    res.json({ message: "Order booked successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
