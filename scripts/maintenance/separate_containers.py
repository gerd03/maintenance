with open(r'c:\Users\PC2\Desktop\AOAS WEB\careers.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the map section placement
old_text = '''            </form>

            <!-- Map Section -->
            <div class="map-section">'''

new_text = '''            </form>
        </div>

        <!-- Map Section -->
        <div class="form-container" style="margin-top: 32px;">
            <div class="map-section">'''

content = content.replace(old_text, new_text)

with open(r'c:\Users\PC2\Desktop\AOAS WEB\careers.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully separated the form and map containers!")
