import pymongo

client = pymongo.MongoClient('ds037067.mongolab.com', 37067)
db = client.monopoly
db.authenticate("thedrick", "thedrick")
collection = db.properties

mongolab = pymongo.MongoClient('ds041157.mongolab.com', 41157)
mongolab_monopoly = mongolab["cmuopoly"]
mongolab_monopoly.authenticate("amittere", "amittere")
mongolab_props = mongolab_monopoly.properties

props_to_insert = []

for prop in collection.find():
	print prop
	props_to_insert.append(prop)

#mongolab_props.insert(props_to_insert)