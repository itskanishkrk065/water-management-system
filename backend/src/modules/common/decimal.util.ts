import { Decimal } from 'decimal.js';

export class DecimalUtil {
  /**
   * Safe decimal addition
   */
  static add(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).plus(new Decimal(b));
  }

  /**
   * Safe decimal subtraction
   */
  static sub(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).minus(new Decimal(b));
  }

  /**
   * Safe decimal multiplication
   */
  static mul(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).times(new Decimal(b));
  }

  /**
   * Safe decimal division
   */
  static div(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    const divisor = new Decimal(b);
    if (divisor.isZero()) {
      throw new Error('Division by zero is not permitted in decimal arithmetic');
    }
    return new Decimal(a).dividedBy(divisor);
  }

  /**
   * Round to 2 decimal places (standard financial currency rounding, half-up)
   */
  static roundMoney(val: number | string | Decimal): Decimal {
    return new Decimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  /**
   * Round to 4 decimal places (for acre / precision volumetric rates)
   */
  static roundPrecision(val: number | string | Decimal, places = 4): Decimal {
    return new Decimal(val).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  }

  /**
   * Compares two decimal values with small epsilon tolerance (e.g. for parcel area sum checks)
   */
  static equalsWithTolerance(a: number | string | Decimal, b: number | string | Decimal, tolerance = '0.0001'): boolean {
    const diff = new Decimal(a).minus(new Decimal(b)).abs();
    return diff.lessThanOrEqualTo(new Decimal(tolerance));
  }

  /**
   * Sums an array of decimal values
   */
  static sum(values: (number | string | Decimal)[]): Decimal {
    return values.reduce<Decimal>((acc, val) => acc.plus(new Decimal(val)), new Decimal(0));
  }
}
