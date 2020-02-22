import * as bcrypt from "bcryptjs";
import fs = require("fs");

let _secrets: { [key: string]: string };
try {
  const rawdata = fs.readFileSync("./_secret.json");
  _secrets = JSON.parse(rawdata.toString());
  console.log("SECRET LOADED OK!");
  console.log(_secrets);
} catch (e) {
  console.log(" ==== ERROR ====");
  console.log(
    "MISSING ADMIN SECRET! - add _secret.json with {admin: 'secret_to_verify'}"
  );
  console.log(" ====       ====");
  process.exit(1);
}

export const secrets = _secrets;

export const hashPassword = (
  password: string,
  rounds: number
): Promise<any> => {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, rounds, (error: Error, hash: string) => {
      if (error) {
        reject(error);
      } else {
        resolve(hash);
      }
    });
  });
};

export const compare = (password: string, dbHash: string): Promise<boolean> => {
  return new Promise(resolve => {
    bcrypt.compare(password, dbHash, (err: Error, match: boolean) => {
      if (err) {
        resolve(false);
      }
      resolve(match);
    });
  });
};
