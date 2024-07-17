import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

/*
users: id , name , color
visited_countries: id , #user_id , #country_code
countreis : id , country_code , country_name

*/

// Database connection configuration
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "admin",
  port: 5432,
});
db.connect(); // Connect to the PostgreSQL database

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs"); // Set EJS as the template engine

// Function to fetch all users from the database
async function getUsers() {
  let users = await db.query("SELECT * FROM users");
  return users;
}

// Function to fetch a specific user by their ID
async function getUser(userId) {
  const user = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
  return user.rows[0];
}

// Function to check which countries a user has visited
async function checkVisited(userId) {
  const result = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1",
    [userId]
  );
  return result.rows.map((row) => row.country_code);
}

// Route to render the home page with user data
app.get("/", async (req, res) => {
  try {
    const users = await getUsers();
    const user = users.rows[0]; // Get the first user
    const firstUserId = user.id;
    const countries = await checkVisited(firstUserId); // Get the countries visited by the first user

    // Render the index.ejs template with user data
    res.render("index.ejs", {
      users: users.rows,
      user,
      color: user.color,
      countries,
      total: countries.length,
    });
  } catch (error) {
    console.error("Error fetching data", error);
    res.status(500).send("Internal Server Error");
  }
});

// Route to add a new country to a user's visited list
app.post("/add/:id", async (req, res) => {
  const input = req.body["country"];
  const userId = req.params.id;

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Country not found");
    }

    const countryCode = result.rows[0].country_code;

    try {
      await db.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [countryCode, userId]
      );
      res.redirect("/");
    } catch (err) {
      console.log(err);
      res.status(500).send("Error adding visited country");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Error finding country");
  }
});

// Route to handle user selection or adding a new user
app.post("/user", async (req, res) => {
  try {
    if (req.body.add === "new") {
      // If adding a new user, render the new user form
      res.render("new.ejs");
    } else {
      // If selecting an existing user
      const userId = req.body.user;
      const user = await getUser(userId);
      const countries = await checkVisited(userId);
      const users = await getUsers();

      // Render the index.ejs template with the selected user's data
      res.render("index.ejs", {
        users: users.rows,
        user,
        color: user.color,
        countries,
        total: countries.length,
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Error processing user action");
  }
});

// Route to create a new user
app.post("/new", async (req, res) => {
  let name = req.body.name || "user"; // Default name if not provided
  let color = req.body.color || "red"; // Default color if not provided

  try {
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING id",
      [name, color]
    );

    const userId = result.rows[0].id;
    const user = await getUser(userId);
    const countries = await checkVisited(userId);
    const users = await getUsers();

    // Render the index.ejs template with the new user's data
    res.render("index.ejs", {
      users: users.rows,
      user,
      color: user.color,
      countries,
      total: countries.length,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating new user");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
