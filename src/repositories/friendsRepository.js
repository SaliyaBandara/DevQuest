import knex from "knex";
import knex_db from "../../db/db-config.js";
import userRepository from "./userRepository.js";
import httpStatus from "../enums/httpStatus.js";

let _db;
function init(db) {
  _db = db;
}

//Update this method to complete challenge2.a
async function getSuggestedFriends(userId) {
  try {
    const userHobbies = await knex_db('hobbies').where('userId', userId).select('name', 'rate');
    const otherUsers = await knex_db('hobbies').whereNot('userId', userId).whereIn('name', userHobbies.map(hobby => hobby.name)).select('userId', 'name', 'rate');

    const friends = await knex_db('friends').where('status', 'ACCEPTED').andWhere(function () {
      this.where('sender_id', userId).orWhere('recipient_id', userId);
    });
    const friendIds = friends.map(friend => friend.sender_id == userId ? friend.recipient_id : friend.sender_id);

    let filteredOtherUsers = otherUsers.filter(user => !friendIds.includes(user.userId));
    filteredOtherUsers = filteredOtherUsers.map(user => {
      const userHobby = userHobbies.find(hobby => hobby.name === user.name);
      const rateDifference = Math.abs(userHobby.rate - user.rate);
      return { ...user, rateDifference };
    }).sort((a, b) => a.rateDifference - b.rateDifference);

    const minRateDifference = filteredOtherUsers[0].rateDifference;
    filteredOtherUsers = filteredOtherUsers.filter(user => user.rateDifference === minRateDifference);
    filteredOtherUsers = filteredOtherUsers.slice(0, 5);

    const suggestedFriends = await Promise.all(filteredOtherUsers.map(async user => {
      const userDetails = await userRepository.getUser(user.userId);
      return userDetails;
    }));

    suggestedFriends.forEach(user => {
      user.hobbies.sort((a, b) => a.name.localeCompare(b.name));
    });

    return suggestedFriends;
  } catch (error) {
    console.error("Could not fetch suggested friends:", error);
    return [];
  }
}

//Update this method to complete challenge3.a, challenge3.b and challenge3.c
async function sendReq(data) {
  const { sender_id, recipient_id, status } = data;
  return new Promise((resolve, reject) => {
    knex_db
      .raw(
        "SELECT * FROM friends WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)",
        [sender_id, recipient_id, recipient_id, sender_id]
      )
      .then((exists) => {
        if (exists.length > 0) {
          if (
            exists[0].sender_id === recipient_id &&
            exists[0].recipient_id === sender_id
          ) {
            resolve({
              status: httpStatus.BAD_REQUEST,
              text: "Request already received!",
            });
            return;
          }
          resolve({
            status: httpStatus.BAD_REQUEST,
            text: "Request already sent!",
          });
          return;
        } else {
          knex_db
            .raw(
              "INSERT INTO friends (sender_id, recipient_id, status) VALUES (?, ?, ?)",
              [sender_id, recipient_id, status]
            )
            .then(() => {
              resolve({ status: httpStatus.OK, text: "success" });
            })
            .catch((error) => {
              reject(error);
            });
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}

async function getPeopleYouMayKnow(id) {
  const parsedId = parseInt(id);
  return new Promise((resolve, reject) => {
    resolve([]);
  });
}

//Update this method to view the users to whom the requests were sent and complete challenge3.d
async function viewSentReqs(id) {
  return new Promise((resolve, reject) => {
    knex_db
      .raw("SELECT * FROM friends WHERE sender_id = ? AND status = ?", [
        id,
        "PENDING",
      ])
      .then((sentRequests) => {
        resolve(sentRequests);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

//Update this method to view the users whose the requests were received and complete challenge3.e
async function viewPendingReqs(id) {
  console.log("id", id)
  return new Promise((resolve, reject) => {
    knex_db
      .select(
        "friends.id as reqId",
        "users.id",
        "users.email",
        "users.gender",
        "users.firstname",
        "users.lastname",
        "users.image_url",
      )
      // .from("friends")
      // .join("users", "users.id", "friends.sender_id")
      // // .join("user_hobbies", "user_hobbies.user_id", "users.id")
      // .join("hobbies", "hobbies.id", "users.id")
      // // .join("user_skills", "user_skills.user_id", "users.id")
      // .join("skills", "skills.id", "hobbies.id")
      // .where("friends.recipient_id", id)
      // .andWhere("friends.status", "PENDING")
      // .groupBy("users.id", "friends.id")
      .then((pendingRequests) => {
        console.log("aaaaaaaaaa", pendingRequests);
        resolve(pendingRequests);
      })
      .catch((error) => {
        console.error(error);
        reject(error);
      });
  });
}


//Update this method to complete the challenge3.f
async function acceptReq(id) {
  console.log("ID---", id)
  return new Promise((resolve, reject) => {
    knex_db
      .raw("UPDATE friends SET status = 'ACCEPTED' WHERE id = ?", [id])
      .then(() => {
        resolve({ text: "success" });
      })
      .catch((error) => {
        reject(error);
      });
  });
}

//Update this method to complete the challenge3.g
async function rejectReq(id) {
  return new Promise((resolve, reject) => {
    knex_db
      .raw("DELETE from friends WHERE status = 'PENDING' AND id = ?", [id])
      .then(() => {
        resolve("Request deleted successfully!");
      })
      .catch((error) => {
        console.error(error);
        reject(error);
      });
  });
}


async function cancelReq(id) {
  const friendRequest = await knex_db('friends')
      .where('id', id)
      .andWhere('status', 'PENDING') 
      .first();

  if (!friendRequest) {
      return "Request not found!";
  }

  await knex_db('friends')
      .where('id', id)
      .del();

  return "Request cancelled successfully!";
}


async function removeFriend(id) {
  // console.log(id);
  const result = await knex_db('friends')
      .where('id', id)
      .andWhere('status', 'ACCEPTED') 
      .first();
      
  if (!result) {
      return "Friend not found!";
  }
  else {
      await knex_db('friends')
          .where('id', id)
          .del();
  }
  // console.log(result);

  if (result) {
      return "Friend removed successfully!";
  } else {
      return "Friend not found!";
  }
}


//Update this method to complete the challenge4.a
async function viewFriends(id) {
  let friends = [];
  return friends;
}

async function getPeopleFromKeyword(id, keyword, pageNumber) {
  let query;
  const pageSize = 3;
  const offset = (pageNumber - 1) * pageSize;
  if (!keyword) {
    query = "";
  } else {
    query = "";
  }
  return new Promise((resolve, reject) => {
    resolve([]);
  });
}

export default {
  init,
  getSuggestedFriends,
  sendReq,
  getPeopleYouMayKnow,
  viewSentReqs,
  viewPendingReqs,
  acceptReq,
  rejectReq,
  cancelReq,
  removeFriend,
  viewFriends,
  getPeopleFromKeyword,
};
