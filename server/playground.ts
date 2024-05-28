function subsetSum(arr: number[]) {
    const ans: number[] = [];
    function helper(start: number, sum: number) {
        if (start >= arr.length) {
            ans.push(sum);
            return;
        }

        helper(start + 1, sum + arr[start]);
        helper(start + 1, sum);
    }
    helper(0, 0);
    return ans;
}

console.log(subsetSum([1, 2, 3])); // [6, 5, 4, 3, 2, 1, 0]
