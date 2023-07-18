const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
dotenv.config();

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.render("index");
})

app.get("/get-menu", (req, res) => {
    res.render("index");
})

app.get("/cart", (req, res) => {
    res.render("customers/cart");
})

app.listen(PORT, (error) => {
    if (error) console.log(error);
    else console.log("Server is running on PORT: " + PORT);
})