// Features whose backend routes don't exist yet. The UI is built and wired;
// flip a flag to true once the matching route is deployed.
//
//   enterpriseTeam  -> /team ("My team") page + its link in the account menu.
//                      Uses /my/subscriptions and its /seats routes.
//   deleteQuestions -> DELETE /questions/:questionId
//   deleteReplies   -> DELETE /comments/:commentId/replies/:replyId
//                      DELETE /questions/:questionId/replies/:replyId
//
// While false, the delete buttons for these are hidden, so learners never
// hit a 404 ROUTE_NOT_FOUND.
export const FEATURES = {
  enterpriseTeam: true,
  deleteQuestions: false,
  deleteReplies: false,
};