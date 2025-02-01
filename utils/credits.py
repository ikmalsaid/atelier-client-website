import random
import string
import argparse
from datetime import datetime
from utils.database import Database

class Credits:
    """Atelier Credits System. Copyright (C) 2024 Ikmal Said. All rights reserved."""
    def __init__(self):
        """Initialize credit system with predefined bundles and empty pin codes"""
        self.db = Database()
        
        self.currency = 'MYR'
        
        self.credit_bundles = {
            'Small': {'credits': 10, 'price': 1.99},
            'Medium': {'credits': 100, 'price': 17.99},
            'Large': {'credits': 1000, 'price': 89.99}
        }
        
        self.pin_codes = {}

    def get_current_timestamp(self):
        """Return formatted timestamp string for current date and time"""
        return datetime.now().strftime('%d/%m/%Y %H:%M:%S')

    def get_credit_bundles(self):
        """Return dictionary of available credit bundle options"""
        return self.credit_bundles

    def generate_pin_code(self, bundle_size):
        """Generate unique 8-character PIN code for credit bundle redemption"""
        while True:
            pin = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            if pin not in self.pin_codes:
                self.pin_codes[pin] = bundle_size
                return pin

    def process_payment(self, user_id, bundle_size):
        """Process simulated payment transaction and return status with transaction details"""
        success = random.choice([True, False])
        transaction_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=12))
        error_message = None

        if not success:
            error_message = "Payment failed. Please try again."

        return success, transaction_id, error_message

    def purchase_credits(self, user_id, bundle_size):
        """Process credit bundle purchase and generate redemption PIN code"""
        if bundle_size not in self.credit_bundles:
            return False, "Invalid bundle size"

        success, transaction_id, error_message = self.process_payment(user_id, bundle_size)

        if not success:
            self.db.add_user_history(
                user_id=user_id,
                type='Credit Topup',
                task=f'Attempted to purchase {self.credit_bundles[bundle_size]["credits"]} credits',
                detail=f'Package: {bundle_size} | Price: {self.currency}{self.credit_bundles[bundle_size]["price"]:.2f}',
                status='failed',
                timestamp=self.get_current_timestamp(),
                result_url=None
            )
            return False, error_message

        pin_code = self.generate_pin_code(bundle_size)
        
        self.db.add_user_history(
            user_id=user_id,
            type='Credit Topup',
            task=f'Purchased {self.credit_bundles[bundle_size]["credits"]} credits',
            detail=f'Package: {bundle_size} | Price: {self.currency}{self.credit_bundles[bundle_size]["price"]:.2f} | PIN Code: {pin_code}',
            status='success',
            timestamp=self.get_current_timestamp(),
            result_url=None
        )
        return True, pin_code

    def redeem_pin_code(self, user_id, pin_code):
        """Validate PIN code and add corresponding credits to user account"""
        if pin_code not in self.pin_codes:
            return False, "Invalid PIN code"

        bundle_size = self.pin_codes[pin_code]
        credits_to_add = self.credit_bundles[bundle_size]['credits']

        current_credits = self.db.get_user_credits(user_id)
        new_credits = current_credits + credits_to_add
        self.db.update_user_credits(user_id, new_credits)

        self.db.add_user_history(
            user_id=user_id,
            type='Credit Topup',
            task=f'Redeemed {credits_to_add} credits',
            detail=f'Package: {bundle_size} | Price: {self.currency}{self.credit_bundles[bundle_size]["price"]:.2f}',
            status='success',
            timestamp=self.get_current_timestamp(),
            result_url=None
        )

        del self.pin_codes[pin_code]

        return True, f"Successfully added {credits_to_add} credits. New balance: {new_credits}"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Stella Credits Manager')
    parser.add_argument('-t', nargs=2, metavar=('USERNAME', 'AMOUNT'),
                       help='Topup credits to a user. Usage: -t username amount')
    parser.add_argument('-d', nargs=2, metavar=('USERNAME', 'AMOUNT'),
                       help='Deduct credits from a user. Usage: -d username amount')
    
    args = parser.parse_args()
    
    if args.t or args.d:
        username, amount = args.t if args.t else args.d
        try:
            amount = int(amount)
            if args.d:
                amount = -amount
                
            sc = Credits()
            
            # Get user_id from username
            user_id = sc.db.get_user_id(username)
            if not user_id:
                print(f"Error: User '{username}' not found")
                exit(1)
                
            current_credits = sc.db.get_user_credits(user_id)
            new_credits = current_credits + amount
            
            # Check if deduction would result in negative balance
            if new_credits < 0:
                print(f"Error: Cannot deduct {abs(amount)} credits. User only has {current_credits} credits.")
                exit(1)
                
            sc.db.update_user_credits(user_id, new_credits)
            
            # Log the credit modification
            sc.db.add_user_history(
                user_id=user_id,
                type='Credit Update',
                task=f'Adjusted credits by {amount:+}',  # Uses +/- sign prefix
                detail=f'Previous balance: {current_credits} | New balance: {new_credits}',
                status='success',
                timestamp=sc.get_current_timestamp(),
                result_url=None
            )
            print(f"Successfully adjusted credits by {amount:+} for {username}. New balance: {new_credits}")
        
        except ValueError:
            raise Exception("Amount must be a number")
        
        except Exception as e:
            print(f"Error: {str(e)}")