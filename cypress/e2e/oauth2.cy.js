describe('OAuth2 Settings', () => {
  beforeEach(() => {
    cy.resetState();

    // Instance initial setup
    cy.registerUser('admin', 'pass', true);

    // Create user account
    cy.registerUser('alice', 'alice1234');

    // Sign in as the user
    cy.signin('alice', 'alice1234');
  });

  afterEach(() => {
    cy.wait(1000);
  });

  it('can access OAuth2 settings page', () => {
    // Navigate to the OAuth2 settings page
    cy.visit('/settings/oauth2');
    
    // Verify the page title
    cy.contains('OAuth2 Applications');
    
    // Check that the form to create a new application is present
    cy.contains('Add application');
  });

  it('can create an OAuth2 application', () => {
    cy.visit('/settings/oauth2');
    
    // Fill in application details
    cy.get('input[type="text"]').eq(0).type('Test OAuth App');
    cy.get('input[type="text"]').eq(1).type('A test application for OAuth2');
    
    // Add a redirect URI
    cy.contains('Add redirect URI').click();
    cy.get('.redirectUri input').type('https://example.com/callback');
    
    // Select permissions
    cy.get('select').click();
    cy.contains('read:account').click();
    cy.get('body').click(); // Close the select dropdown
    
    // Make sure OAuth2 switch is enabled
    cy.get('input[type="checkbox"]').should('be.checked');
    
    // Create the application
    cy.contains('Create').click();
    
    // Verify the app is created and appears in the list
    cy.contains('Test OAuth App');
    cy.contains('https://example.com/callback');
  });
});
