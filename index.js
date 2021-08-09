/*/
 * This file takes 'ios' or 'android' as argument
 * 
 * File Types:
 * - Contacts
 * --- Google CSV √
 * --- vCard √
/*/

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const process = require("process");
const csv = require("@fast-csv/parse");
const vCard = require("vcard");

// **************************** Contacts **************************** //

let parseGoogleContactsFromCSV = () => {
  let contactFileSrc = `./files/google-contacts-csv.csv`;
  let reponse = fs
    .createReadStream(path.resolve(contactFileSrc))
    .pipe(
      csv.parse({
        headers: (headers) =>
          headers.map((header) => {
            header = header.replace(/[^A-Za-z0-9]/g, "");
            return header;
          }),
      })
    )
    .on("error", (error) => {
      console.error(error);
    })
    .on("data", (row) => {
      parseGoogleCSVContact(row);
    })
    .on("end", (rowCount) => {
      console.log(`Parsed ${rowCount} rows`);
    });
  return reponse;
};
// parseGoogleContactsFromCSV();

let parseGoogleCSVContact = (item) => {
  let phoneNumbers = [];
  let emails = [];
  let addresses = [];
  let websites = [];
  let relations = [];
  let cleanupList = [];

  // Setup Lists
  Object.entries(item).map(([key, value]) => {
    if (key.match("Phone")) {
      if (value !== "") {
        phoneNumbers.push(value);
      }
    }

    if (key.match("Email")) {
      if (key.match("Value")) {
        if (value !== "") {
          emails.push(value);
        }
      }
    }

    if (key.match("Address")) {
      if (key.match("Formatted")) {
        if (value !== "") {
          addresses.push(value.replaceAll("\n", ", "));
        }
      }
    }

    if (key.match("Website")) {
      if (key.match("Value")) {
        if (value !== "") {
          if (value.includes(" ::: ")) {
            let split_websites = value.split(" ::: ");
            split_websites.map((num) => {
              websites.push(num);
            });
          } else {
            websites.push(value);
          }
        }
      }
    }

    if (value === "") {
      cleanupList.push(key);
    }
  });
  cleanupList.map((cleanItem) => {
    delete item[cleanItem];
  });

  // Phone Numbers
  let phoneEvens = phoneNumbers.filter((item, i) => {
    return i % 2 === 0;
  });
  let phoneOdds = phoneNumbers.filter((item, i) => {
    return i % 2 !== 0;
  });

  let formattedPhoneNumbers = [];
  phoneEvens.map((typeVal) => {
    phoneOdds.map((numVal) => {
      let obj = {
        type: typeVal,
        number: numVal.replace(/\D/g, ""),
      };
      formattedPhoneNumbers.push(obj);
    });
  });
  formattedPhoneNumbers = formattedPhoneNumbers.filter(
    (thing, index, self) =>
      index === self.findIndex((t) => t.number === thing.number)
  );

  // Birthdate
  let splitBirthday = item.Birthday ? item.Birthday.split("-") : null;
  let year = item.Birthday ? parseFloat(splitBirthday[0]) : null;
  let month = item.Birthday ? parseFloat(splitBirthday[1]) : null;
  let day = item.Birthday ? parseFloat(splitBirthday[2]) : null;
  let formattedBirthday = item.Birthday
    ? new Date(year, month - 1, day, 0, 0, 0, 0).getTime()
    : "";

  // Emails  & Addresses
  // Not currently formatting emails or addresses
  // Just getting full address for now

  // End it
  let response = {
    name_first: "",
    name_last: "",
    name_full: "",
    avatar_src: item.Photo ? item.Photo : "",
    email: JSON.stringify(emails),
    phone: JSON.stringify(formattedPhoneNumbers),
    address: JSON.stringify(addresses),
    website: JSON.stringify(websites),
    relationship: JSON.stringify(relations),
    birthdate: formattedBirthday,
    type: "Person",
    app_used: "Google Contacts - Exported CSV",
    longitude: "",
    latitude: "",
    body: JSON.stringify(item),
    notes: item.Notes ? item.Notes : "",
  };

  response.name_first = item.GivenName;
  response.name_last = item.FamilyName ? item.FamilyName : "";
  response.name_full = `${item.GivenName ? item.GivenName : ""} ${
    item.FamilyName ? item.FamilyName : ""
  }`.trim();

  // Post Profiles to Database
  // pushProfileToArchive(response);
  console.log("RESPONSE: ", response);
  // }
};

let parseAppleVcardFile = () => {
  let path = "./files/vcards.vcf";
  let card = new vCard();

  card.readFile(path, (err, json) => {
    if (err) return err;
    json.map((item, i) => {
      let phoneNumbers = [];
      let emails = [];

      // Name
      let name_split = item.N.split(",");
      let name_first = name_split[1] ? name_split[1].trim() : "";
      let name_last = name_split[0] ? name_split[0].trim() : "";

      // Phone
      let has_phone_nmbr = item.TEL;
      let phone_type = has_phone_nmbr ? has_phone_nmbr.type : null;
      let phone_number = has_phone_nmbr ? has_phone_nmbr.value : null;

      let ptf = phone_type !== null ? phone_type[2] : "";
      let tmp_type = ptf ? ptf.split("=") : null;
      let numb_type = tmp_type !== null ? tmp_type[1].toLowerCase() : null;
      numb_type === "cell" ? (numb_type = "mobile") : numb_type;

      let phn_nmbr_formatted = phone_number
        ? phone_number.replace(/\D/g, "")
        : "";
      let full_phone = {
        type: numb_type,
        number: phn_nmbr_formatted,
      };
      phoneNumbers.push(full_phone);

      // Email
      let email1 = item.EMAIL ? item.EMAIL.value : "";
      email1 !== "" ? emails.push(email1) : null;

      // Birthdate
      let splitBirthday = item.BDAY ? item.BDAY.split("-") : null;
      let year = item.BDAY ? parseFloat(splitBirthday[0]) : null;
      let month = item.BDAY ? parseFloat(splitBirthday[1]) : null;
      let day = item.BDAY ? parseFloat(splitBirthday[2]) : null;
      let formattedBirthday = item.BDAY
        ? new Date(year, month - 1, day, 0, 0, 0, 0).getTime()
        : "";

      // Avatar
      let img64 = {
        type: item.PHOTO ? item.PHOTO.type[0] : null,
        val: item.PHOTO ? item.PHOTO.value : null,
      };
      if (img64.type && img64.type === "TYPE=JPEG") img64.type = "jpeg";
      let imgBuffer = img64.val ? Buffer.from(img64.val, "base64") : null;

      let imgPath = `./img/${
        name_first ? name_first.toLowerCase() + "--" : ""
      }${name_last ? name_last.toLowerCase() : ""}.jpg`;

      !name_first && !name_last ? (imgPath = `./img/no-name.jpg`) : null;

      if (img64.val && img64.val !== null) {
        fs.writeFile(imgPath, imgBuffer, "base64", (err) => {
          console.log(err);
        });
      }

      delete item.PHOTO;

      // Response
      let response = {
        name_first: name_first,
        name_last: name_last,
        name_full: item.FN,
        avatar_src: img64.val && img64.val !== null ? imgPath : "",
        phone: JSON.stringify(phoneNumbers),
        email: JSON.stringify(emails),
        birthdate: formattedBirthday,
        type: "Person",
        app_used: "Apple Contact - vCard Export",
        longitude: "",
        latitude: "",
        body: JSON.stringify(item),
        notes: item.NOTE ? item.NOTE : "",
        // work: item.ORG ? item.ORG : "",
      };

      return console.log({ response });

      /*       
      let addresses = [];
      let websites = [];
      let relations = [];

      let response = {
        address: JSON.stringify(addresses),
        website: JSON.stringify(websites),
        relationship: JSON.stringify(relations),
      };
      */
    });
  });
};
// parseAppleVcardFile();

// **************************** - Axios - **************************** //

let pushProfileToArchive = async (payload) => {
  console.log("PAYLOAD: ", payload);
  /*
  let token =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjJiZDk5ZmQwLTJmMTYtNDE2Ny04MjczLTEyN2JiYTM5ODFhNyIsInVzZXJuYW1lIjoiZWxpcmljaGV5IiwiaWF0IjoxNjI3NzA1NDQzLCJleHAiOjE2MjgzMTAyNDN9.3ExdqOMWDSfyZmMjgNHSgGd_VWUL1euoQ8swx_qV0Og";
  axios
    .post(`http://localhost:3000/profile`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .then((res) => {
      console.log(res.data);
    })
    .catch((error) => {
      console.log("Error Pushing User to Database", error);
    });
    */
};

process.argv.forEach((val, index) => {
  if (index > 1) {
    let x = val.toString().toLowerCase();
    x === "android" ? parseGoogleContactsFromCSV() : null;
    x === "ios" ? parseAppleVcardFile() : null;
  }
});
