// +build OMIT

package main

import "fmt"

func BinarySearchFirst(arr []int, target int) (index int) {
	n := len(arr)
	lo := 0
	hi := n - 1
	for lo <= hi {
		mid := lo + (hi-lo)>>1
		if arr[mid] == target {
			if mid == 0 || arr[mid-1] != target {
				return mid
			} else {
				hi = mid
			}
		} else if arr[mid] < target {
			lo = mid + 1
		} else {
			hi = mid - 1
		}
	}
	return -1
}

func main() {
	arr := []int{1, 2, 3, 4, 4, 4, 4, 5, 6, 7}
	fmt.Println("expect 3 and get", BinarySearchFirst(arr, 4))
}
