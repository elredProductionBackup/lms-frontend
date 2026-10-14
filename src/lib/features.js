// Features whose backend routes don't exist yet. The UI is built and wired;
// flip a flag to true once the matching route is deployed.
//
//   deleteQuestions -> DELETE /questions/:questionId
//   deleteReplies   -> DELETE /comments/:commentId/replies/:replyId
//                      DELETE /questions/:questionId/replies/:replyId
//
// While false, the delete buttons for these are hidden, so learners never
// hit a 404 ROUTE_NOT_FOUND.
export const FEATURES = {
  deleteQuestions: false,
  deleteReplies: false,
};