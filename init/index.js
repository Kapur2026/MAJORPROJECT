const mongoose=require("mongoose");
const initdata=require("./data.js");
const listing=require("../models/listing.js");

const mongodbURL="mongodb://127.0.0.1:27017/appdb";
main()
.then(()=>{
    console.log("Connected to MongoDB");
})
.catch((err)=>{
    console.log("Error connecting to MongoDB:", err);
});
async function main() {
    await mongoose.connect(mongodbURL);
}

const initDB=async()=>{
    await listing.deleteMany({});
    initdata.data=initdata.data.map((obj)=>({...obj,owner:new mongoose.Types.ObjectId("699aa020b7bc10e9f053c62d")}));
    await listing.insertMany(initdata.data);
    console.log("Database seeded with sample data");
};

initDB();
