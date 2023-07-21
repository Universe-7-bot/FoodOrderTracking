const express = require("express");
const app = express();
const { auth } = require("express-openid-connect");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
dotenv.config();

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

app.get("/", (req, res) => {
    // console.log(req.oidc.user);
    res.render("index", { isAuthenticated: req.oidc.isAuthenticated() });
})

app.get("/get-menu", (req, res) => {
    res.render("index", { isAuthenticated: req.oidc.isAuthenticated() });
})

app.get("/cart", (req, res) => {
    res.render("customers/cart", { isAuthenticated: req.oidc.isAuthenticated() });
})

app.listen(PORT, (error) => {
    if (error) console.log(error);
    else console.log("Server is running on PORT: " + PORT);
})