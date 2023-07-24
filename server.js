const express = require("express");
const app = express();
const { auth } = require("express-openid-connect");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const menu = require("./models/menu.js");
const dotenv = require("dotenv");
dotenv.config();

mongoose.set('strictQuery', false);
mongoose.connect(process.env.DB_URL).then(() => {
    console.log("Connected with database");
}).catch((err) => {
    console.log(err);
})

const config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.SECRET,
    baseURL: process.env.BASE_URL,
    clientID: process.env.CLIENT_ID,
    issuerBaseURL: process.env.ISSUER
};

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(express.json());
app.use(auth(config));

const PORT = process.env.PORT || 5000;

app.get("/", async(req, res) => {
    // console.log(req.oidc.user);
    const allMenu = await menu.find({});
    // console.log(allMenu);
    res.render("index", { isAuthenticated: req.oidc.isAuthenticated(), menu: allMenu });
})

app.get("/get-menu", async (req, res) => {
    const allMenu = await menu.find({});
    res.render("index", { isAuthenticated: req.oidc.isAuthenticated(), menu: allMenu });
})

app.get("/cart", (req, res) => {
    res.render("customers/cart", { isAuthenticated: req.oidc.isAuthenticated() });
})

app.listen(PORT, (error) => {
    if (error) console.log(error);
    else console.log("Server is running on PORT: " + PORT);
})