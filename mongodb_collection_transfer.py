import pymongo

source = pymongo.MongoClient('ds041157.mongolab.com', 41157)
source_db = source["cmuopoly"]
source_db.authenticate("amittere", "amittere")
source_props = source_db.properties
source_chance = source_db.chance
source_commchest = source_db.communitychest

dest = pymongo.MongoClient('localhost', 27017)
dest_db = dest["cmuopoly"]
dest_db.authenticate("amittere", "amittere")
dest_props = dest_db.properties
dest_chance = dest_db.chance
dest_commchest = dest_db.communitychest

props_to_insert = []
chance_to_insert = []
commchest_to_insert = []

for prop in source_props.find():
	print prop
	props_to_insert.append(prop)

for chance in source_chance.find():
    print chance
    chance_to_insert.append(chance)

for commchest in source_commchest.find():
    print commchest
    commchest_to_insert.append(commchest)

#dest_props.insert(props_to_insert)
#dest_chance.insert(chance_to_insert)
#dest_commchest.insert(commchest_to_insert)