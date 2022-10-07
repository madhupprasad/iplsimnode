import lodash from "lodash";

export function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

export const addAdditionalDetails = (data) => {
    const newData = lodash.cloneDeep(data);
    newData["currentBid"] = Math.floor(newData["base"]);
    newData["highestBidderId"] = "";
    return newData;
};
