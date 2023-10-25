
const selectAllTransferInformationQuery = "SELECT * FROM TransferInformation";
const transferInformationRows = executeQuery(selectAllTransferInformationQuery);
console.log(transferInformationRows)



// Define the section's CRN you want to retrieve schedules for
const sectionCRN = 10168;

// Query to get all schedules for a specific section
const schedulesForSectionQuery = `
  SELECT Schedules.*
  FROM Schedules
  INNER JOIN Sections ON Schedules.year = Sections.year
                      AND Schedules.term = Sections.term
                      AND Schedules.crn = Sections.crn
  WHERE Sections.crn = ${sectionCRN} AND Sections.year = 2024 AND Sections.term = 10
`;

const schedulesForSection = executeQuery(schedulesForSectionQuery);
console.log(schedulesForSection);


document.getElementById("searchButton").onclick=searchCourses
