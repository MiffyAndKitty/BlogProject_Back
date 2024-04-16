export class plusService {
  static plusNums(numsDto: { num1: string; num2: string }) {
    if (!isNaN(parseInt(numsDto.num1)) && !isNaN(parseInt(numsDto.num2))) {
      return {
        success: true,
        data: parseInt(numsDto.num1) + parseInt(numsDto.num2)
      };
    }
    return { success: false, data: null };
  }
}
