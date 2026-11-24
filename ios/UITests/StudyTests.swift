import XCTest

final class StudyTests: XCTestCase {
    func testSessionSurvivesRelaunch() throws {
        let app = XCUIApplication()
        app.launch()
        let title = app.textFields["titleField"]
        title.tap()
        title.typeText("Blocco sintetico")
        app.buttons["Fine"].tap()
        let criterion = app.descendants(matching: .any).matching(identifier: "criterionField").firstMatch
        criterion.tap()
        criterion.typeText("Spiegare il metodo")
        app.buttons["Fine"].tap()
        app.buttons["Avvia blocco"].tap()
        XCTAssertTrue(app.buttons["Pausa"].waitForExistence(timeout: 5))
        XCUIDevice.shared.press(.home)
        app.activate()
        app.buttons["Pausa"].tap()
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Riprendi"].waitForExistence(timeout: 5))
        let evidence = XCTAttachment(screenshot: app.screenshot())
        evidence.name = "Blocco sintetico in pausa"
        evidence.lifetime = .keepAlways
        add(evidence)
        let metrics = [XCTCPUMetric(application: app)]
        measure(metrics: metrics) { Thread.sleep(forTimeInterval: 1) }
        app.buttons["Riprendi"].tap()
        XCTAssertTrue(app.buttons["Pausa"].exists)
    }
    func testLibraryAndScrolling() {
        let app = XCUIApplication()
        app.launch()
        app.buttons["Piano"].tap()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Unità 1")).firstMatch.waitForExistence(timeout: 5))
        let options = XCTMeasureOptions()
        options.iterationCount = 3
        measure(metrics: [XCTOSSignpostMetric.scrollDecelerationMetric], options: options) {
            app.swipeUp()
            app.swipeDown()
        }
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["Viaggi"].tap()
        XCTAssertTrue(app.webViews.buttons["Simula spostamento"].waitForExistence(timeout: 10))
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["Ripasso"].tap()
        XCTAssertTrue(app.webViews.buttons["Progressi"].waitForExistence(timeout: 10))
    }

    func testLaunchMetric() {
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            XCUIApplication().launch()
        }
    }
}
