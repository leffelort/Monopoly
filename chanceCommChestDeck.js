/* Node module that manages a chance/community chest deck.
 */

var client;

module.exports = function init(c) {
  client = c;
  
  return {
    drawChance: function(game) {
      if (game.chanceDeck.length === 0) {
        // If deck is empty, query the database again
        client.collection('chance', function (error, coll) {
          if (!error) {
            coll.toArray(function (err, arr) {
              if (!err) {
                game.chanceDeck = arr;
                if (game.chanceJailCardUsed) {
                  game.chanceDeck.splice(12, 1);
                }
              }
            });
          }
        });
      }
      
      // pick a random card, remove it from the deck, then return it
      if (game.chanceDeck.length > 0) {
        var index = Math.floor(Math.random() * game.chanceDeck.length);
        var card = game.chanceDeck.splice(index, 1);
        if (card.id === 12) {
          // if get out of jail free, mark it as being used
          game.chanceJailCardUsed = true;
        }
        return card[0];
      } else {
        return undefined;
      }
    },
    drawCommChest: function(game) {
      if (game.commChestDeck.length === 0) {
        // If deck is empty, query the database again
        client.collection('communitychest', function (error, coll) {
          if (!error) {
            coll.toArray(function (err, arr) {
              if (!err) {
                game.commChestDeck = arr;
                if (game.commChestJailCardUsed) {
                  game.commChestDeck.splice(12, 1);
                }
              }
            });
          }
        });
      }
      
      // pick a random card, remove it from the deck, then return it
      if (game.commChestDeck.length > 0) {
        var index = Math.floor(Math.random() * game.commChestDeck.length);
        var card = game.commChestDeck.splice(index, 1);
        if (card.id === 12) {
          game.commChestJailCardUsed = true;
        }
        return card[0];
      } else {
        return undefined;
      }
    },
    returnChanceJailCard = function(game) {
      game.chanceJailCardUsed = false;
    },
    returnCommChestJailCard = function(game) {
      game.commChestJailCardUsed = false;
    }
  };
}

/*
module.exports.drawChance = function(game) {
  if (game.chanceDeck.length === 0) {
    // If deck is empty, query the database again
    client.collection('chance', function (error, coll) {
      if (!error) {
        coll.toArray(function (err, arr) {
          if (!err) {
            game.chanceDeck = arr;
            if (game.chanceJailCardUsed) {
              game.chanceDeck.splice(12, 1);
            }
          }
        });
      }
    });
  }
  
  // pick a random card, remove it from the deck, then return it
  if (game.chanceDeck.length > 0) {
    var index = Math.floor(Math.random() * game.chanceDeck.length);
    var card = game.chanceDeck.splice(index, 1);
    if (card.id === 12) {
      // if get out of jail free, mark it as being used
      game.chanceJailCardUsed = true;
    }
    return card[0];
  } else {
    return undefined;
  }
}

module.exports.drawCommChest = function(game) {
  if (game.commChestDeck.length === 0) {
    // If deck is empty, query the database again
    client.collection('communitychest', function (error, coll) {
      if (!error) {
        coll.toArray(function (err, arr) {
          if (!err) {
            game.commChestDeck = arr;
            if (game.commChestJailCardUsed) {
              game.commChestDeck.splice(12, 1);
            }
          }
        });
      }
    });
  }
  
  // pick a random card, remove it from the deck, then return it
  if (game.commChestDeck.length > 0) {
    var index = Math.floor(Math.random() * game.commChestDeck.length);
    var card = game.commChestDeck.splice(index, 1);
    if (card.id === 12) {
      game.commChestJailCardUsed = true;
    }
    return card[0];
  } else {
    return undefined;
  }
}

module.exports.returnChanceJailCard = function(game) {
  game.chanceJailCardUsed = false;
}

module.exports.returnCommChestJailCard = function(game) {
  game.commChestJailCardUsed = false;
}
*/
