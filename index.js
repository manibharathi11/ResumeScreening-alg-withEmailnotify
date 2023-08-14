const express = require("express");
const app = express();
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const pdfjs = require("pdfjs-dist");
const natural = require("natural");
const { createTransport } = require("nodemailer");

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "_" + Date.now() + path.extname(file.originalname)
    );
  },
});

let maxSize = 2 * 1000 * 1000;
let upload = multer({
  storage: storage,
  limits: {
    fileSize: maxSize,
  },
  fileFilter: function (req, file, cb) {
    let filetypes = /pdf/;
    let mimetype = filetypes.test(file.mimetype);
    let extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(new Error("Error: File upload only supports PDF filetypes."));
  },
}).single("mypic");

app.get("/", (req, res) => {
  res.render("signup");
});

app.post("/upload", (req, res, next) => {
  upload(req, res, async function (err) {
    if (err) {
      return res.send(err.message);
    } else {
      const userEmail = req.body.email;
      const pdfFilePath = req.file.path;
      const jobDescriptionFilePath = "resume.json"; // Change this to the path of your job description JSON file

      const [extractedText, jobDescription] = await Promise.all([
        extractInformationFromPDF(pdfFilePath),
        readJSON(jobDescriptionFilePath),
      ]);

      const rankedMatches = rankMatches(extractedText, jobDescription);

      // Display the ranked matches
      console.log("Ranked Matches:");
      rankedMatches.forEach((match, index) => {
        console.log(
          `${index + 1}. Attribute: ${match.key}, Similarity: ${
            match.similarity
          }`
        );
      });

      let total = 0;
      rankedMatches.forEach((match) => {
        total += match.similarity;
      });

      if (total > 350) {
        emailAutomation(req.body.email);
      }

      res.send("Your Resume has been successfully submitted and ranked.");
    }
  });
});

// Function to read the contents of a PDF file
async function extractInformationFromPDF(filePath) {
  // Code to extract information from PDF
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjs.getDocument(data);
  const pdfDocument = await loadingTask.promise;

  const extractedText = [];
  for (let i = 1; i <= pdfDocument.numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    extractedText.push(pageText);
  }

  return extractedText.join("\n");
}

// Function to read the contents of a JSON file
function readJSON(filePath) {
  const rawData = fs.readFileSync(filePath);
  const jsonData = JSON.parse(rawData);
  return jsonData;
}

// Function to rank the matches
function rankMatches(extractedText, jobDescription) {
  // Code to rank matches
  const rankedMatches = [];
  for (const key in jobDescription) {
    if (jobDescription.hasOwnProperty(key)) {
      const value = jobDescription[key];
      if (typeof value === "string") {
        const similarity = natural.JaroWinklerDistance(
          extractedText.toLowerCase(),
          value.toLowerCase(),
          {
            ignoreCase: true,
          }
        );
        const similarityScale10 = similarity * 100;
        rankedMatches.push({ key, similarity: similarityScale10 });
      } else {
        console.warn(`Warning: Value for attribute "${key}" is not a string.`);
      }
    }
  }
  rankedMatches.sort((a, b) => b.similarity - a.similarity);
  return rankedMatches;
}

// Email automation
const emailAutomation = function (recipientEmail) {
  const transporter = createTransport({
    host: "smtp-relay.sendinblue.com", // Update with your SMTP server details
    port: 587,
    auth: {
      user: "manibharathiinreallife@gmail.com",
      pass: "TLx62k8MDXJrRzCI",
    },
  });

  const mailOptions = {
    from: "ashikcsbtech@gmail.com",
    to: recipientEmail,
    subject: "**Congratulations! You are selected for next round**",
    text: `
        Dear Candidate,
    
        We hope this message finds you well. We are pleased to inform you that your resume has been shortlisted for the next round of our interview process for the [Job Title] position at [Company Name].
        
        Here are the details for the upcoming round:
        
        
        Please be prepared for: Communication test
    
        REQUIREMENTS: Proper internet connection, Avoid background noises and do the test in the peaceful place.
        
        We are excited to continue the evaluation process with you. If you have any questions or require further information, please feel free to reply to this email.
        
        We appreciate your interest in joining our team and look forward to meeting you for the next round.
        
        Best regards,
        Lakshmanan,
        Software Engineer
        velakshman@gmail.com    
        Remember to keep the email professional, courteous, and informative to create a positive candidate experience. 
        `,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log(
        `Email sent successfully to :${recipientEmail} ` + info.response
      );
    }
  });
};

app.listen(3000, () => {
  console.log("Example app listening on port 3000!");
});
