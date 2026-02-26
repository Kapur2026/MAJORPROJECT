const dns = require('node:dns/promises');
dns.setServers(['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4']);
require("dotenv").config(); 

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const override = require("method-override");
const ejsMate = require("ejs-mate");
const { listingSchema, reviewSchema } = require("./schema.js");
const Review = require("./models/review.js");
const session = require('express-session');
const MongoStore = require("connect-mongo").default; 
const flash = require("connect-flash");
const passport = require("passport");
const LocalStartegy = require("passport-local");
const User = require("./models/user.js");



const dbUrl = process.env.ATLASDB_URL;
main()
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((err) => {
        console.log("Error connecting to MongoDB:", err);
    });

async function main() {
    await mongoose.connect(dbUrl);
}

const store=MongoStore.create({
    mongoUrl:dbUrl,
    collectionName:'sessions',
    crypto:{
    secret: process.env.SECRET,
    },
    touchAfter:24*3600,
});

store.on("error",function(err){
    console.log("error:",err);
});

const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
};



app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(override("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStartegy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

app.use(session({
    secret: process.env.SECRET,   
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: { 
        maxAge: 7*24 * 60 * 60 * 1000  
    }
}));

//signup rout
app.get("/signup", (req, res) => {
    console.log(req.flash("success"));
    res.render("users/signup.ejs");
});

//signup post
app.post("/signup", async (req, res) => {
    try {
        let { username, email, password } = req.body;
        const newUser = new User({ email, username });
        const registeredUser = await User.register(newUser, password);
        console.log(registeredUser);
        req.login(registeredUser, (err) => {
            if (err) {
                return next(err);
            }
            req.flash("success", "signup successfull");
            res.redirect("/listings");
        });

    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/listings");
    }
});

//login rout
app.get("/login", (req, res) => {
    console.log(req.flash("success"));
    res.render("users/login.ejs");
});

//login check
app.post("/login", passport.authenticate("local",
    { failureRedirect: '/login', failureFlash: true }),
    async (req, res) => {
        req.flash("you are login");
        res.redirect("/listings");
    });

//log out rout
app.get("/logout", (req, res, next) => {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        req.flash("success", "logged out!");
        res.redirect("listings");
    });
});

const validateListing = (req, res, next) => {
    let { error } = listingSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

const validateReview = (req, res, next) => {
    let { error } = reviewSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

//All listing rout
app.get("/listings",async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", { allListings });
});

//create new listing
app.get("/listings/new", (req, res) => {
    if (!req.isAuthenticated()) {
        req.flash("error", "you must be logged in to craete listing!");
        return res.redirect("/login");
    }
    res.render("listings/new.ejs");
});

app.get("/listings/:id", async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id).populate("reviews")
        .populate("owner");
    console.log(listing);
    console.log(listing.reviews);
    res.render("listings/show.ejs", { listing });
});

app.post("/listings", validateListing, async (req, res, next) => {
    try {
        const newListing = new Listing(req.body.listing);
        console.log(req.user);
        newListing.owner = req.user._id;
        await newListing.save();
        console.log(newListing);
        res.redirect("/listings");
    } catch (err) {
        next(err);
    }
});

//edit listing
app.get("/listings/:id/edit", async (req, res) => {
    if (!req.isAuthenticated()) {
        req.flash("error", "you must be logged in to craete listing!");
        return res.redirect("/login");
    }
    let { id } = req.params;
    const listing = await Listing.findById(id);
    res.render("listings/edit.ejs", { listing });
});

app.put("/listings/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
        req.flash("error", "you must be logged in to craete listing!");
        return res.redirect("/login");
    }
    let { id } = req.params;
    await Listing.findByIdAndUpdate(id, { ...req.body.listing });
    res.redirect(`/listings/${id}`);
});

//delete listing
app.delete("/listings/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
        req.flash("error", "you must be logged in to craete listing!");
        return res.redirect("/login");
    }
    let { id } = req.params;
    let deleteListing = await Listing.findByIdAndDelete(id);
    console.log(deleteListing)
    res.redirect("/listings");
});

//review post
app.post("/listings/:id/review", async (req, res) => {
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);

    listing.reviews.push(newReview._id);

    await newReview.save();
    await listing.save();

    res.redirect(`/listings/${listing._id}`);
});

//review delete
app.delete("/listings/:id/reviews/:reviewId", async (req, res) => {
    if (!req.isAuthenticated()) {
        req.flash("error", "you must be logged in to craete listing!");
        return res.redirect("/login");
    }
    let { id, reviewId } = req.params;
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    res.redirect(`/listings/${id}`);
});


app.use((err, req, res, next) => {
    res.send(err.message);
});

app.listen(8080, () => {
    console.log("server running");
});