import pymongo

client = pymongo.MongoClient('ds037067.mongolab.com', 37067)
db = client.monopoly
db.authenticate("thedrick", "thedrick")
collection = db.properties

mongolab = pymongo.MongoClient('ds045557.mongolab.com', 45557)
mongolab_monopoly = mongolab["heroku_app14631401"]
mongolab_monopoly.authenticate("heroku_app14631401", "4ccecvoit0u9pn6ssu7gmm439g")
mongolab_props = mongolab_monopoly.properties

props_to_insert = []

for prop in collection.find():
	print prop
	props_to_insert.append(prop)

#mongolab_props.insert(props_to_insert)