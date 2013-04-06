import pymongo

client = pymongo.MongoClient('localhost', 27017)
db = client.monopoly

collection = db.properties

mongolab = pymongo.MongoClient('ds037067.mongolab.com', 37067)
mongolab_monopoly = mongolab.monopoly
mongolab_monopoly.authenticate("thedrick", "thedrick")
mongolab_props = mongolab_monopoly.properties

props_to_insert = []

for prop in collection.find():
	props_to_insert.append(prop)

## mongolab_props.insert(props_to_insert)